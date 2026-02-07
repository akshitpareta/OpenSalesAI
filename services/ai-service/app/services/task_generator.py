"""
AI-powered task generation engine.

Analyses 90-day store transaction history, computes per-store features,
retrieves store profiles via RAG, and uses an LLM to generate prioritised
daily tasks with reasoning for each sales representative.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.rag.pipeline import RAGPipeline
from app.rag.prompts import TASK_GENERATOR_PROMPT

logger = logging.getLogger(__name__)


# ── Output Models ────────────────────────────────────────────────────────────


class GeneratedTask(BaseModel):
    """A single AI-generated task for a store visit."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    store_name: str = ""
    action: str
    reasoning: str
    priority: int = Field(ge=0, le=100)
    task_type: str = "general"
    product_ids: list[str] = Field(default_factory=list)
    product_names: list[str] = Field(default_factory=list)
    estimated_impact_inr: float = 0.0
    suggested_pitch: str = ""


class BatchResult(BaseModel):
    """Summary of a batch task generation run."""

    company_id: str
    total_reps: int = 0
    total_tasks_generated: int = 0
    total_stores_processed: int = 0
    errors: list[str] = Field(default_factory=list)
    duration_seconds: float = 0.0
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StoreFeatures(BaseModel):
    """Computed features for a single store over the history window."""

    store_id: str
    store_name: str
    channel: str = ""
    city: str = ""
    state: str = ""
    credit_tier: str = "B"
    lat: float = 0.0
    lng: float = 0.0
    last_visit_date: str | None = None
    days_since_last_visit: int = 999
    last_order_date: str | None = None
    days_since_last_order: int = 999
    avg_order_value: float = 0.0
    purchase_frequency: float = 0.0
    total_revenue_90d: float = 0.0
    total_orders_90d: int = 0
    top_products: str = ""
    msl_compliance: float = 0.0
    msl_gaps: int = 0


# ── Service ──────────────────────────────────────────────────────────────────


class TaskGeneratorService:
    """Generates personalised daily tasks for sales reps using AI."""

    def __init__(
        self,
        db: AsyncSession,
        rag_pipeline: RAGPipeline,
        settings: Settings | None = None,
    ) -> None:
        self._db = db
        self._rag = rag_pipeline
        self._settings = settings or get_settings()

    async def generate_tasks_for_rep(
        self,
        rep_id: str,
        company_id: str,
    ) -> list[GeneratedTask]:
        """Generate AI-powered daily tasks for a single rep.

        Steps:
            1. Fetch the rep's assigned stores (from beat plan).
            2. Compute per-store features over the last 90 days.
            3. For each store, RAG-retrieve context and LLM-generate tasks.
            4. De-duplicate and cap at max tasks per rep.
            5. Persist tasks to the database.

        Returns:
            List of generated tasks sorted by priority (descending).
        """
        # Get rep info
        rep = await self._get_rep(rep_id, company_id)
        if rep is None:
            logger.warning("Rep %s not found for company %s.", rep_id, company_id)
            return []

        # Get stores on the rep's beat for today
        stores = await self._get_rep_stores(rep_id, company_id)
        if not stores:
            logger.info("No stores assigned to rep %s.", rep_id)
            return []

        # Compute features for each store
        all_tasks: list[GeneratedTask] = []
        for store_row in stores:
            store_features = await self._compute_store_features(
                store_id=store_row["id"],
                company_id=company_id,
            )
            if store_features is None:
                continue

            try:
                tasks = await self._generate_tasks_for_store(
                    rep=rep,
                    store=store_features,
                    company_id=company_id,
                )
                all_tasks.extend(tasks)
            except Exception:
                logger.exception(
                    "Task generation failed for store %s.", store_row["id"]
                )

        # Sort by priority (descending) and cap
        all_tasks.sort(key=lambda t: t.priority, reverse=True)
        all_tasks = all_tasks[: self._settings.TASK_MAX_PER_REP]

        # Filter out low-priority tasks
        all_tasks = [
            t for t in all_tasks if t.priority >= self._settings.TASK_MIN_PRIORITY
        ]

        # Persist to DB
        await self._persist_tasks(all_tasks, rep_id, company_id)

        logger.info(
            "Generated %d tasks for rep %s (company %s).",
            len(all_tasks),
            rep_id,
            company_id,
        )
        return all_tasks

    async def generate_all_tasks(self, company_id: str) -> BatchResult:
        """Generate tasks for all active reps in a company.

        Designed to be called nightly by the n8n workflow.
        """
        start = datetime.now(timezone.utc)
        result = BatchResult(company_id=company_id)

        # Get all active reps
        reps = await self._get_all_reps(company_id)
        result.total_reps = len(reps)

        for rep_row in reps:
            rep_id = str(rep_row["id"])
            try:
                tasks = await self.generate_tasks_for_rep(rep_id, company_id)
                result.total_tasks_generated += len(tasks)
                # Count unique stores
                result.total_stores_processed += len(
                    {t.store_id for t in tasks}
                )
            except Exception as exc:
                error_msg = f"Rep {rep_id}: {exc}"
                result.errors.append(error_msg)
                logger.exception("Failed to generate tasks for rep %s.", rep_id)

        result.duration_seconds = (
            datetime.now(timezone.utc) - start
        ).total_seconds()
        result.generated_at = datetime.now(timezone.utc)

        logger.info(
            "Batch task generation complete: %d reps, %d tasks, %d errors, %.1fs.",
            result.total_reps,
            result.total_tasks_generated,
            len(result.errors),
            result.duration_seconds,
        )
        return result

    # ── Private: Data Fetching ────────────────────────────────────────

    async def _get_rep(self, rep_id: str, company_id: str) -> dict[str, Any] | None:
        """Fetch a rep's profile."""
        query = text("""
            SELECT id, name, phone, territory_id, skill_tier, points_balance
            FROM reps
            WHERE id = :rep_id
              AND company_id = :company_id
              AND deleted_at IS NULL
        """)
        result = await self._db.execute(
            query, {"rep_id": rep_id, "company_id": company_id}
        )
        row = result.mappings().first()
        return dict(row) if row else None

    async def _get_all_reps(self, company_id: str) -> list[dict[str, Any]]:
        """Get all active reps for a company."""
        query = text("""
            SELECT id, name, phone, territory_id, skill_tier, points_balance
            FROM reps
            WHERE company_id = :company_id
              AND deleted_at IS NULL
            ORDER BY name
        """)
        result = await self._db.execute(query, {"company_id": company_id})
        return [dict(row) for row in result.mappings().all()]

    async def _get_rep_stores(
        self, rep_id: str, company_id: str
    ) -> list[dict[str, Any]]:
        """Get stores assigned to a rep via beat plans for today."""
        today_dow = datetime.now(timezone.utc).weekday()  # 0=Monday
        query = text("""
            SELECT DISTINCT s.id, s.name, s.channel, s.city, s.state,
                   s.lat, s.lng, s.credit_tier
            FROM stores s
            INNER JOIN beats b ON b.store_id = s.id
            WHERE b.rep_id = :rep_id
              AND b.company_id = :company_id
              AND b.day_of_week = :day_of_week
              AND b.deleted_at IS NULL
              AND s.deleted_at IS NULL
            ORDER BY s.name
        """)
        result = await self._db.execute(
            query,
            {
                "rep_id": rep_id,
                "company_id": company_id,
                "day_of_week": today_dow,
            },
        )
        return [dict(row) for row in result.mappings().all()]

    async def _compute_store_features(
        self,
        store_id: str,
        company_id: str,
    ) -> StoreFeatures | None:
        """Compute store features from transaction history."""
        cutoff = datetime.now(timezone.utc) - timedelta(
            days=self._settings.TASK_HISTORY_DAYS
        )

        # Store info
        store_query = text("""
            SELECT id, name, channel, city, state, lat, lng, credit_tier
            FROM stores
            WHERE id = :store_id
              AND company_id = :company_id
              AND deleted_at IS NULL
        """)
        store_result = await self._db.execute(
            store_query, {"store_id": store_id, "company_id": company_id}
        )
        store_row = store_result.mappings().first()
        if store_row is None:
            return None

        # Transaction summary
        txn_query = text("""
            SELECT
                COUNT(*) as order_count,
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(AVG(total_amount), 0) as avg_order_value,
                MAX(created_at) as last_order_date
            FROM transactions
            WHERE store_id = :store_id
              AND company_id = :company_id
              AND created_at >= :cutoff
              AND deleted_at IS NULL
        """)
        txn_result = await self._db.execute(
            txn_query,
            {"store_id": store_id, "company_id": company_id, "cutoff": cutoff},
        )
        txn_row = txn_result.mappings().first()

        # Last visit
        visit_query = text("""
            SELECT MAX(check_in_at) as last_visit
            FROM visits
            WHERE store_id = :store_id
              AND company_id = :company_id
              AND deleted_at IS NULL
        """)
        visit_result = await self._db.execute(
            visit_query, {"store_id": store_id, "company_id": company_id}
        )
        visit_row = visit_result.mappings().first()

        # Top products
        top_products_query = text("""
            SELECT p.name, SUM(ti.quantity) as total_qty
            FROM transaction_items ti
            INNER JOIN transactions t ON t.id = ti.transaction_id
            INNER JOIN products p ON p.id = ti.product_id
            WHERE t.store_id = :store_id
              AND t.company_id = :company_id
              AND t.created_at >= :cutoff
              AND t.deleted_at IS NULL
            GROUP BY p.name
            ORDER BY total_qty DESC
            LIMIT 5
        """)
        top_products_result = await self._db.execute(
            top_products_query,
            {"store_id": store_id, "company_id": company_id, "cutoff": cutoff},
        )
        top_products = [
            f"{row['name']} ({row['total_qty']})"
            for row in top_products_result.mappings().all()
        ]

        # MSL compliance (products available vs total MSL products)
        msl_query = text("""
            SELECT
                COUNT(DISTINCT ti.product_id) as products_ordered,
                (SELECT COUNT(*) FROM products
                 WHERE company_id = :company_id
                   AND is_msl = true
                   AND deleted_at IS NULL) as total_msl
            FROM transaction_items ti
            INNER JOIN transactions t ON t.id = ti.transaction_id
            INNER JOIN products p ON p.id = ti.product_id AND p.is_msl = true
            WHERE t.store_id = :store_id
              AND t.company_id = :company_id
              AND t.created_at >= :cutoff
              AND t.deleted_at IS NULL
        """)
        try:
            msl_result = await self._db.execute(
                msl_query,
                {"store_id": store_id, "company_id": company_id, "cutoff": cutoff},
            )
            msl_row = msl_result.mappings().first()
            total_msl = int(msl_row["total_msl"]) if msl_row and msl_row["total_msl"] else 0
            products_ordered = int(msl_row["products_ordered"]) if msl_row and msl_row["products_ordered"] else 0
        except Exception:
            total_msl = 0
            products_ordered = 0

        msl_compliance = (products_ordered / total_msl * 100) if total_msl > 0 else 100.0
        msl_gaps = max(0, total_msl - products_ordered)

        # Compute days since last order / visit
        now = datetime.now(timezone.utc)
        last_order_dt = txn_row["last_order_date"] if txn_row else None
        last_visit_dt = visit_row["last_visit"] if visit_row else None

        days_since_order = (now - last_order_dt).days if last_order_dt else 999
        days_since_visit = (now - last_visit_dt).days if last_visit_dt else 999

        order_count = int(txn_row["order_count"]) if txn_row else 0
        history_months = self._settings.TASK_HISTORY_DAYS / 30.0
        purchase_frequency = order_count / history_months if history_months > 0 else 0

        return StoreFeatures(
            store_id=store_id,
            store_name=str(store_row["name"]),
            channel=str(store_row["channel"] or ""),
            city=str(store_row["city"] or ""),
            state=str(store_row["state"] or ""),
            credit_tier=str(store_row["credit_tier"] or "B"),
            lat=float(store_row["lat"] or 0),
            lng=float(store_row["lng"] or 0),
            last_visit_date=last_visit_dt.isoformat() if last_visit_dt else None,
            days_since_last_visit=days_since_visit,
            last_order_date=last_order_dt.isoformat() if last_order_dt else None,
            days_since_last_order=days_since_order,
            avg_order_value=float(txn_row["avg_order_value"]) if txn_row else 0,
            purchase_frequency=round(purchase_frequency, 1),
            total_revenue_90d=float(txn_row["total_revenue"]) if txn_row else 0,
            total_orders_90d=order_count,
            top_products=", ".join(top_products) if top_products else "No orders",
            msl_compliance=round(msl_compliance, 1),
            msl_gaps=msl_gaps,
        )

    # ── Private: Task Generation ──────────────────────────────────────

    async def _generate_tasks_for_store(
        self,
        rep: dict[str, Any],
        store: StoreFeatures,
        company_id: str,
    ) -> list[GeneratedTask]:
        """Use the RAG pipeline + LLM to generate tasks for a store."""
        # Get territory name
        territory_name = "Default Territory"
        if rep.get("territory_id"):
            try:
                territory_query = text(
                    "SELECT name FROM territories WHERE id = :tid AND deleted_at IS NULL"
                )
                t_result = await self._db.execute(
                    territory_query, {"tid": str(rep["territory_id"])}
                )
                t_row = t_result.mappings().first()
                if t_row:
                    territory_name = str(t_row["name"])
            except Exception:
                pass

        template_vars = {
            "rep_name": rep.get("name", "Unknown"),
            "territory_name": territory_name,
            "skill_tier": rep.get("skill_tier", "B"),
            "points_balance": rep.get("points_balance", 0),
            "store_id": store.store_id,
            "store_name": store.store_name,
            "channel": store.channel,
            "city": store.city,
            "state": store.state,
            "credit_tier": store.credit_tier,
            "last_visit_date": store.last_visit_date or "Never",
            "days_since_last_visit": store.days_since_last_visit,
            "last_order_date": store.last_order_date or "Never",
            "days_since_last_order": store.days_since_last_order,
            "avg_order_value": f"{store.avg_order_value:,.0f}",
            "purchase_frequency": store.purchase_frequency,
            "total_revenue_90d": f"{store.total_revenue_90d:,.0f}",
            "top_products": store.top_products,
            "msl_compliance": store.msl_compliance,
            "msl_gaps": store.msl_gaps,
        }

        try:
            rag_result = await self._rag.query(
                query_text=f"Store {store.store_name} {store.channel} {store.city} tasks",
                collection=self._settings.QDRANT_COLLECTION_STORE_PROFILES,
                filters={"company_id": company_id},
                prompt_template=TASK_GENERATOR_PROMPT,
                template_vars=template_vars,
                top_k=3,
            )

            raw_tasks = rag_result.get("result")
            if isinstance(raw_tasks, list):
                tasks = [
                    GeneratedTask(
                        store_id=store.store_id,
                        store_name=store.store_name,
                        action=t.get("action", "Visit store"),
                        reasoning=t.get("reasoning", "Scheduled visit"),
                        priority=min(100, max(0, int(t.get("priority", 50)))),
                        task_type=t.get("task_type", "general"),
                        product_ids=t.get("product_ids", []),
                        product_names=t.get("product_names", []),
                        estimated_impact_inr=float(
                            t.get("estimated_impact_inr", 0)
                        ),
                        suggested_pitch=t.get("suggested_pitch", ""),
                    )
                    for t in raw_tasks
                ]
                return tasks
        except Exception:
            logger.warning(
                "LLM task generation failed for store %s, falling back to rules.",
                store.store_id,
            )

        # Rule-based fallback
        return self._rule_based_tasks(store)

    def _rule_based_tasks(self, store: StoreFeatures) -> list[GeneratedTask]:
        """Generate tasks using simple rules when LLM is unavailable."""
        tasks: list[GeneratedTask] = []

        # Reactivation
        if store.days_since_last_order >= 14:
            tasks.append(
                GeneratedTask(
                    store_id=store.store_id,
                    store_name=store.store_name,
                    action=f"Reactivate {store.store_name} — no order in {store.days_since_last_order} days",
                    reasoning=(
                        f"Store has not placed an order in {store.days_since_last_order} days. "
                        f"Previous average order was INR {store.avg_order_value:,.0f}. "
                        f"Risk of losing this outlet to competition."
                    ),
                    priority=min(100, 50 + store.days_since_last_order),
                    task_type="reactivation",
                    estimated_impact_inr=store.avg_order_value,
                    suggested_pitch=(
                        "We noticed it's been a while since your last order. "
                        "Let me show you our latest offers."
                    ),
                )
            )

        # MSL fill
        if store.msl_gaps > 0:
            tasks.append(
                GeneratedTask(
                    store_id=store.store_id,
                    store_name=store.store_name,
                    action=f"Fill {store.msl_gaps} MSL gaps at {store.store_name}",
                    reasoning=(
                        f"Store is missing {store.msl_gaps} Must Stock List products. "
                        f"MSL compliance is only {store.msl_compliance}%. "
                        f"Filling these gaps increases store revenue potential."
                    ),
                    priority=min(90, 40 + store.msl_gaps * 5),
                    task_type="msl_fill",
                    estimated_impact_inr=store.msl_gaps * 500,
                    suggested_pitch=(
                        "I noticed a few popular products are missing from your shelf. "
                        "Let me help you stock them — they're top sellers in your area."
                    ),
                )
            )

        # Upsell for active stores
        if store.days_since_last_order < 7 and store.purchase_frequency >= 4:
            tasks.append(
                GeneratedTask(
                    store_id=store.store_id,
                    store_name=store.store_name,
                    action=f"Upsell to {store.store_name} — increase basket size",
                    reasoning=(
                        f"Active store ordering {store.purchase_frequency}x/month "
                        f"with avg INR {store.avg_order_value:,.0f}. "
                        f"High-frequency stores have upsell potential."
                    ),
                    priority=45,
                    task_type="upsell",
                    estimated_impact_inr=store.avg_order_value * 0.2,
                    suggested_pitch=(
                        "Thank you for being a regular customer! "
                        "I have a special combo deal that could work well for your store."
                    ),
                )
            )

        return tasks

    # ── Private: Persistence ──────────────────────────────────────────

    async def _persist_tasks(
        self,
        tasks: list[GeneratedTask],
        rep_id: str,
        company_id: str,
    ) -> None:
        """Write generated tasks to the tasks table."""
        if not tasks:
            return

        for task in tasks:
            insert_query = text("""
                INSERT INTO tasks (
                    id, rep_id, store_id, action, priority, status,
                    ai_reasoning, task_type, product_ids, estimated_impact,
                    suggested_pitch, company_id, created_at, updated_at
                ) VALUES (
                    :id, :rep_id, :store_id, :action, :priority, 'pending',
                    :reasoning, :task_type, :product_ids, :estimated_impact,
                    :suggested_pitch, :company_id, NOW(), NOW()
                )
                ON CONFLICT (id) DO NOTHING
            """)
            try:
                await self._db.execute(
                    insert_query,
                    {
                        "id": task.id,
                        "rep_id": rep_id,
                        "store_id": task.store_id,
                        "action": task.action,
                        "priority": task.priority,
                        "reasoning": task.reasoning,
                        "task_type": task.task_type,
                        "product_ids": task.product_ids,
                        "estimated_impact": task.estimated_impact_inr,
                        "suggested_pitch": task.suggested_pitch,
                        "company_id": company_id,
                    },
                )
            except Exception:
                logger.exception("Failed to persist task %s.", task.id)
