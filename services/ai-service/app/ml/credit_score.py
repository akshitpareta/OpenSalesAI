"""
Retailer credit scoring using XGBoost.

Assigns credit tiers (A/B/C/D) based on payment history, order frequency,
average order value, and days outstanding. The credit tier determines
what promotions and credit terms a retailer can receive.
"""

from __future__ import annotations

import logging
import pickle
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class CreditFactor(BaseModel):
    """A single contributing factor to the credit score."""

    name: str
    value: float
    impact: str = "positive"  # positive, negative, neutral
    description: str = ""


class CreditScore(BaseModel):
    """Credit score result for a retail store."""

    store_id: str
    store_name: str = ""
    tier: str = "B"  # A, B, C, D
    score: int = Field(ge=0, le=100, default=50)
    factors: list[CreditFactor] = Field(default_factory=list)
    recommended_credit_limit_inr: float = 0.0
    max_payment_terms_days: int = 7
    assessment_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CreditScorer:
    """XGBoost-based credit scoring engine for retail stores."""

    FEATURE_NAMES = [
        "on_time_payment_rate",
        "avg_days_to_pay",
        "max_days_overdue",
        "total_orders_90d",
        "order_frequency_monthly",
        "avg_order_value",
        "total_revenue_90d",
        "order_trend",  # positive = increasing
        "bounce_count",  # returned/cancelled orders
        "relationship_months",
        "visit_compliance_rate",
        "msl_compliance_rate",
    ]

    TIER_THRESHOLDS = {
        "A": 75,
        "B": 55,
        "C": 35,
        "D": 0,
    }

    CREDIT_LIMITS = {
        "A": 100_000,
        "B": 50_000,
        "C": 20_000,
        "D": 5_000,
    }

    PAYMENT_TERMS = {
        "A": 30,
        "B": 14,
        "C": 7,
        "D": 0,  # Cash only
    }

    def __init__(
        self,
        db: AsyncSession | None = None,
        settings: Settings | None = None,
        model_dir: str | None = None,
    ) -> None:
        self._db = db
        self._settings = settings or get_settings()
        self._model_dir = Path(model_dir) if model_dir else Path("/app/models/credit")
        self._model = None
        self._scaler = None
        self._load_model()

    def train(self, training_df: pd.DataFrame) -> dict[str, Any]:
        """Train the credit scoring model.

        Args:
            training_df: DataFrame with feature columns and a ``credit_score``
                         target (0-100).

        Returns:
            Training metrics.
        """
        from sklearn.model_selection import train_test_split
        from sklearn.preprocessing import StandardScaler
        from xgboost import XGBRegressor

        df = training_df.copy()
        for col in self.FEATURE_NAMES:
            if col not in df.columns:
                df[col] = 0

        X = df[self.FEATURE_NAMES].values
        y = df["credit_score"].values.astype(float)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        self._scaler = StandardScaler()
        X_train_scaled = self._scaler.fit_transform(X_train)
        X_test_scaled = self._scaler.transform(X_test)

        self._model = XGBRegressor(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
            tree_method="hist",
            device="cuda",
        )
        self._model.fit(
            X_train_scaled, y_train,
            eval_set=[(X_test_scaled, y_test)],
            verbose=False,
        )

        # Evaluate
        y_pred = self._model.predict(X_test_scaled)
        mae = float(np.mean(np.abs(y_pred - y_test)))
        rmse = float(np.sqrt(np.mean((y_pred - y_test) ** 2)))

        # Feature importance
        importances = dict(
            zip(self.FEATURE_NAMES, self._model.feature_importances_, strict=True)
        )

        self._save_model()

        metrics = {
            "status": "trained",
            "samples": len(training_df),
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "feature_importances": {
                k: round(v, 4)
                for k, v in sorted(importances.items(), key=lambda x: -x[1])
            },
        }
        logger.info("Credit scoring model trained: MAE=%.2f, RMSE=%.2f", mae, rmse)
        return metrics

    async def score(self, store_id: str, company_id: str | None = None) -> CreditScore:
        """Calculate credit score and tier for a store.

        Falls back to rule-based scoring if no trained model is available.
        """
        features = await self._fetch_features(store_id, company_id)
        store_name = features.pop("store_name", "")

        if self._model is not None and self._scaler is not None:
            feature_vector = np.array(
                [[features.get(f, 0) for f in self.FEATURE_NAMES]]
            )
            scaled = self._scaler.transform(feature_vector)
            raw_score = float(self._model.predict(scaled)[0])
            score = int(max(0, min(100, round(raw_score))))
        else:
            # Rule-based scoring
            score = self._rule_based_score(features)

        # Determine tier
        tier = "D"
        for t, threshold in self.TIER_THRESHOLDS.items():
            if score >= threshold:
                tier = t
                break

        # Build contributing factors
        factors = self._build_factors(features)

        return CreditScore(
            store_id=store_id,
            store_name=store_name,
            tier=tier,
            score=score,
            factors=factors,
            recommended_credit_limit_inr=self.CREDIT_LIMITS.get(tier, 5000),
            max_payment_terms_days=self.PAYMENT_TERMS.get(tier, 0),
            assessment_date=datetime.now(timezone.utc),
        )

    def _rule_based_score(self, features: dict[str, Any]) -> int:
        """Simple weighted-sum scoring when no model is available."""
        score = 50.0

        # Payment history (most important)
        on_time_rate = features.get("on_time_payment_rate", 0.5)
        score += (on_time_rate - 0.5) * 40

        # Order frequency
        freq = features.get("order_frequency_monthly", 0)
        if freq >= 4:
            score += 10
        elif freq >= 2:
            score += 5
        elif freq < 1:
            score -= 10

        # Average order value
        aov = features.get("avg_order_value", 0)
        if aov >= 5000:
            score += 10
        elif aov >= 2000:
            score += 5

        # Days overdue penalty
        max_overdue = features.get("max_days_overdue", 0)
        if max_overdue > 60:
            score -= 25
        elif max_overdue > 30:
            score -= 15
        elif max_overdue > 14:
            score -= 5

        # Bounce penalty
        bounces = features.get("bounce_count", 0)
        score -= bounces * 5

        # Relationship bonus
        months = features.get("relationship_months", 0)
        if months >= 24:
            score += 10
        elif months >= 12:
            score += 5

        # Order trend
        trend = features.get("order_trend", 0)
        if trend > 0:
            score += 5
        elif trend < 0:
            score -= 5

        return int(max(0, min(100, round(score))))

    def _build_factors(self, features: dict[str, Any]) -> list[CreditFactor]:
        """Build human-readable factors explaining the score."""
        factors: list[CreditFactor] = []

        on_time = features.get("on_time_payment_rate", 0)
        factors.append(CreditFactor(
            name="Payment Timeliness",
            value=round(on_time * 100, 1),
            impact="positive" if on_time >= 0.8 else "negative" if on_time < 0.6 else "neutral",
            description=f"{on_time * 100:.0f}% of payments made on time",
        ))

        avg_days = features.get("avg_days_to_pay", 0)
        factors.append(CreditFactor(
            name="Average Payment Speed",
            value=round(avg_days, 1),
            impact="positive" if avg_days <= 7 else "negative" if avg_days > 21 else "neutral",
            description=f"Average {avg_days:.0f} days to settle invoices",
        ))

        freq = features.get("order_frequency_monthly", 0)
        factors.append(CreditFactor(
            name="Order Frequency",
            value=round(freq, 1),
            impact="positive" if freq >= 4 else "negative" if freq < 1 else "neutral",
            description=f"{freq:.1f} orders per month",
        ))

        aov = features.get("avg_order_value", 0)
        factors.append(CreditFactor(
            name="Average Order Value",
            value=round(aov, 0),
            impact="positive" if aov >= 5000 else "neutral",
            description=f"INR {aov:,.0f} average order",
        ))

        months = features.get("relationship_months", 0)
        factors.append(CreditFactor(
            name="Relationship Duration",
            value=months,
            impact="positive" if months >= 12 else "neutral",
            description=f"{months:.0f} months as customer",
        ))

        bounces = features.get("bounce_count", 0)
        if bounces > 0:
            factors.append(CreditFactor(
                name="Order Returns/Cancellations",
                value=bounces,
                impact="negative",
                description=f"{bounces} orders returned or cancelled",
            ))

        return factors

    async def _fetch_features(
        self, store_id: str, company_id: str | None = None
    ) -> dict[str, Any]:
        """Compute credit scoring features from the database."""
        features: dict[str, Any] = {f: 0.0 for f in self.FEATURE_NAMES}
        features["store_name"] = ""

        if self._db is None:
            return features

        company_filter = "AND t.company_id = :company_id" if company_id else ""
        params: dict[str, Any] = {"store_id": store_id}
        if company_id:
            params["company_id"] = company_id

        # Store name
        try:
            name_result = await self._db.execute(
                text("SELECT name FROM stores WHERE id = :store_id"),
                {"store_id": store_id},
            )
            name_row = name_result.mappings().first()
            if name_row:
                features["store_name"] = name_row["name"]
        except Exception:
            pass

        # Transaction history
        try:
            txn_query = text(f"""
                SELECT
                    COUNT(*) as order_count,
                    COALESCE(AVG(total_amount), 0) as avg_order_value,
                    COALESCE(SUM(total_amount), 0) as total_revenue,
                    MIN(created_at) as first_order
                FROM transactions t
                WHERE t.store_id = :store_id
                  {company_filter}
                  AND t.created_at >= NOW() - INTERVAL '90 days'
                  AND t.deleted_at IS NULL
            """)
            result = await self._db.execute(txn_query, params)
            row = result.mappings().first()
            if row:
                features["total_orders_90d"] = int(row["order_count"] or 0)
                features["avg_order_value"] = float(row["avg_order_value"] or 0)
                features["total_revenue_90d"] = float(row["total_revenue"] or 0)
                features["order_frequency_monthly"] = features["total_orders_90d"] / 3.0
                if row["first_order"]:
                    features["relationship_months"] = (
                        datetime.now(timezone.utc) - row["first_order"]
                    ).days / 30.0
        except Exception:
            logger.warning("Failed to fetch transaction data for store %s.", store_id)

        # Payment history (simulated — assumes a payments table or uses order statuses)
        try:
            payment_query = text(f"""
                SELECT
                    COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
                    COUNT(*) FILTER (WHERE status IN ('paid', 'overdue', 'pending')) as total_count,
                    COUNT(*) FILTER (WHERE status = 'cancelled' OR status = 'returned') as bounce_count,
                    MAX(CASE WHEN status = 'overdue'
                        THEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400
                        ELSE 0 END) as max_overdue_days
                FROM orders_eb2b t
                WHERE t.store_id = :store_id
                  {company_filter}
                  AND t.deleted_at IS NULL
            """)
            pay_result = await self._db.execute(payment_query, params)
            pay_row = pay_result.mappings().first()
            if pay_row:
                total = int(pay_row["total_count"] or 1)
                paid = int(pay_row["paid_count"] or 0)
                features["on_time_payment_rate"] = paid / max(total, 1)
                features["bounce_count"] = int(pay_row["bounce_count"] or 0)
                features["max_days_overdue"] = float(pay_row["max_overdue_days"] or 0)
        except Exception:
            # Fallback: assume decent payment history
            features["on_time_payment_rate"] = 0.8

        return features

    def _save_model(self) -> None:
        try:
            self._model_dir.mkdir(parents=True, exist_ok=True)
            if self._model:
                with open(self._model_dir / "credit_xgb.pkl", "wb") as f:
                    pickle.dump(self._model, f)
            if self._scaler:
                with open(self._model_dir / "credit_scaler.pkl", "wb") as f:
                    pickle.dump(self._scaler, f)
        except Exception:
            logger.warning("Failed to save credit scoring model.")

    def _load_model(self) -> None:
        try:
            model_path = self._model_dir / "credit_xgb.pkl"
            scaler_path = self._model_dir / "credit_scaler.pkl"
            if model_path.exists() and scaler_path.exists():
                with open(model_path, "rb") as f:
                    self._model = pickle.load(f)  # noqa: S301
                with open(scaler_path, "rb") as f:
                    self._scaler = pickle.load(f)  # noqa: S301
                logger.info("Credit scoring model loaded from disk.")
        except Exception:
            logger.debug("No pre-trained credit scoring model found.")
