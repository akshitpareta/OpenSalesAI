"""
Task generation API endpoints.

POST /tasks/generate — trigger AI task generation for all reps in a company.
GET  /tasks/{rep_id}/today — get today's AI-generated tasks for a rep.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import DbSession
from app.core.security import CurrentUser

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request / Response Models ────────────────────────────────────────────────


class GenerateTasksRequest(BaseModel):
    """Request body for triggering task generation."""

    company_id: str
    rep_id: str | None = None  # If None, generate for all reps


class GenerateTasksResponse(BaseModel):
    """Response from task generation."""

    status: str = "success"
    company_id: str
    total_reps: int = 0
    total_tasks_generated: int = 0
    total_stores_processed: int = 0
    errors: list[str] = Field(default_factory=list)
    duration_seconds: float = 0.0


class TaskItem(BaseModel):
    """A single task in the response."""

    id: str
    store_id: str
    store_name: str = ""
    action: str
    reasoning: str = ""
    priority: int = 50
    task_type: str = "general"
    status: str = "pending"
    product_ids: list[str] = Field(default_factory=list)
    estimated_impact: float = 0.0
    suggested_pitch: str = ""
    created_at: str = ""


class TodayTasksResponse(BaseModel):
    """Response with today's tasks for a rep."""

    rep_id: str
    date: str
    total_tasks: int = 0
    completed: int = 0
    pending: int = 0
    tasks: list[TaskItem] = Field(default_factory=list)


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/generate", response_model=GenerateTasksResponse)
async def generate_tasks(
    body: GenerateTasksRequest,
    request: Request,
    db: DbSession,
    user: CurrentUser,
) -> GenerateTasksResponse:
    """Trigger AI task generation.

    Generates personalised daily tasks for all reps in a company (or a
    specific rep if ``rep_id`` is provided). This endpoint is typically
    called by the nightly n8n workflow at 2 AM.
    """
    settings = get_settings()

    # Build RAG pipeline with app-level services
    from app.rag.pipeline import RAGPipeline
    from app.rag.retriever import QdrantRetriever

    retriever = None
    if hasattr(request.app.state, "qdrant") and request.app.state.qdrant is not None:
        embedding_service = getattr(request.app.state, "embedding_service", None)
        if embedding_service is not None:
            retriever = QdrantRetriever(
                client=request.app.state.qdrant,
                embedding_service=embedding_service,
            )

    rag_pipeline = RAGPipeline(retriever=retriever, settings=settings)

    from app.services.task_generator import TaskGeneratorService

    generator = TaskGeneratorService(db=db, rag_pipeline=rag_pipeline, settings=settings)

    if body.rep_id:
        # Generate for a single rep
        tasks = await generator.generate_tasks_for_rep(
            rep_id=body.rep_id,
            company_id=body.company_id,
        )
        return GenerateTasksResponse(
            company_id=body.company_id,
            total_reps=1,
            total_tasks_generated=len(tasks),
            total_stores_processed=len({t.store_id for t in tasks}),
        )
    else:
        # Generate for all reps
        result = await generator.generate_all_tasks(company_id=body.company_id)
        return GenerateTasksResponse(
            company_id=result.company_id,
            total_reps=result.total_reps,
            total_tasks_generated=result.total_tasks_generated,
            total_stores_processed=result.total_stores_processed,
            errors=result.errors,
            duration_seconds=result.duration_seconds,
        )


@router.get("/{rep_id}/today", response_model=TodayTasksResponse)
async def get_today_tasks(
    rep_id: str,
    db: DbSession,
    user: CurrentUser,
) -> TodayTasksResponse:
    """Get today's AI-generated tasks for a specific rep.

    Returns all tasks created today, ordered by priority (highest first).
    """
    today = datetime.now(timezone.utc).date()

    query = text("""
        SELECT
            t.id,
            t.store_id,
            COALESCE(s.name, '') as store_name,
            t.action,
            COALESCE(t.ai_reasoning, '') as reasoning,
            t.priority,
            COALESCE(t.task_type, 'general') as task_type,
            t.status,
            COALESCE(t.product_ids, '{}') as product_ids,
            COALESCE(t.estimated_impact, 0) as estimated_impact,
            COALESCE(t.suggested_pitch, '') as suggested_pitch,
            t.created_at
        FROM tasks t
        LEFT JOIN stores s ON s.id = t.store_id
        WHERE t.rep_id = :rep_id
          AND DATE(t.created_at AT TIME ZONE 'UTC') = :today
          AND t.deleted_at IS NULL
        ORDER BY t.priority DESC, t.created_at ASC
    """)

    result = await db.execute(query, {"rep_id": rep_id, "today": today})
    rows = result.mappings().all()

    tasks: list[TaskItem] = []
    completed = 0
    pending = 0

    for row in rows:
        task_status = str(row.get("status", "pending"))
        if task_status == "completed":
            completed += 1
        else:
            pending += 1

        # Handle product_ids — may be stored as text[] or JSON
        product_ids_raw = row.get("product_ids", [])
        if isinstance(product_ids_raw, str):
            product_ids_raw = product_ids_raw.strip("{}").split(",") if product_ids_raw.strip("{}") else []
        elif not isinstance(product_ids_raw, list):
            product_ids_raw = []

        created_at = row.get("created_at")
        created_at_str = created_at.isoformat() if created_at else ""

        tasks.append(
            TaskItem(
                id=str(row["id"]),
                store_id=str(row["store_id"]),
                store_name=str(row.get("store_name", "")),
                action=str(row["action"]),
                reasoning=str(row.get("reasoning", "")),
                priority=int(row.get("priority", 50)),
                task_type=str(row.get("task_type", "general")),
                status=task_status,
                product_ids=[str(pid).strip() for pid in product_ids_raw if str(pid).strip()],
                estimated_impact=float(row.get("estimated_impact", 0)),
                suggested_pitch=str(row.get("suggested_pitch", "")),
                created_at=created_at_str,
            )
        )

    return TodayTasksResponse(
        rep_id=rep_id,
        date=today.isoformat(),
        total_tasks=len(tasks),
        completed=completed,
        pending=pending,
        tasks=tasks,
    )
