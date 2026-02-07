"""
Outlet attrition (churn) prediction using Logistic Regression.

Predicts the probability that a retail store will stop ordering
within the next 30 days, based on recency, frequency, monetary,
and engagement features.
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
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class AttritionPrediction(BaseModel):
    """Churn prediction result for a retail store."""

    store_id: str
    store_name: str = ""
    churn_probability: float = Field(ge=0.0, le=1.0, default=0.0)
    risk_level: str = "low"  # low, medium, high, critical
    contributing_factors: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    predicted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AttritionPredictor:
    """Logistic Regression churn predictor for retail outlets."""

    FEATURE_NAMES = [
        "days_since_last_order",
        "days_since_last_visit",
        "order_frequency_30d",
        "order_frequency_60d",
        "order_frequency_90d",
        "frequency_trend",  # 30d freq / 90d freq
        "avg_order_value_30d",
        "avg_order_value_90d",
        "aov_trend",
        "total_revenue_90d",
        "msl_compliance_rate",
        "visit_count_30d",
        "task_completion_rate",
        "credit_tier_numeric",  # A=4, B=3, C=2, D=1
        "relationship_months",
        "complaints_30d",
    ]

    def __init__(
        self,
        db: AsyncSession | None = None,
        settings: Settings | None = None,
        model_dir: str | None = None,
    ) -> None:
        self._db = db
        self._settings = settings or get_settings()
        self._model_dir = Path(model_dir) if model_dir else Path("/app/models/attrition")
        self._model: LogisticRegression | None = None
        self._scaler: StandardScaler | None = None
        self._load_model()

    def train(self, training_df: pd.DataFrame) -> dict[str, Any]:
        """Train the churn prediction model.

        Args:
            training_df: DataFrame with feature columns and binary ``churned`` target.

        Returns:
            Training metrics.
        """
        from sklearn.metrics import classification_report, roc_auc_score
        from sklearn.model_selection import train_test_split

        df = training_df.copy()
        for col in self.FEATURE_NAMES:
            if col not in df.columns:
                df[col] = 0

        X = df[self.FEATURE_NAMES].fillna(0).values
        y = df["churned"].values.astype(int)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        self._scaler = StandardScaler()
        X_train_scaled = self._scaler.fit_transform(X_train)
        X_test_scaled = self._scaler.transform(X_test)

        self._model = LogisticRegression(
            C=1.0,
            class_weight="balanced",
            max_iter=1000,
            solver="lbfgs",
            random_state=42,
        )
        self._model.fit(X_train_scaled, y_train)

        y_pred = self._model.predict(X_test_scaled)
        y_proba = self._model.predict_proba(X_test_scaled)[:, 1]
        auc = roc_auc_score(y_test, y_proba) if len(set(y_test)) > 1 else 0.0
        report = classification_report(y_test, y_pred, output_dict=True)

        # Feature coefficients
        coefficients = dict(
            zip(self.FEATURE_NAMES, self._model.coef_[0], strict=True)
        )

        self._save_model()

        metrics = {
            "status": "trained",
            "samples": len(training_df),
            "auc_roc": round(auc, 4),
            "precision": round(report.get("1", {}).get("precision", 0), 4),
            "recall": round(report.get("1", {}).get("recall", 0), 4),
            "f1_score": round(report.get("1", {}).get("f1-score", 0), 4),
            "feature_coefficients": {
                k: round(v, 4)
                for k, v in sorted(coefficients.items(), key=lambda x: -abs(x[1]))
            },
        }
        logger.info("Attrition model trained: AUC=%.4f", auc)
        return metrics

    async def predict(
        self, store_id: str, company_id: str | None = None
    ) -> AttritionPrediction:
        """Predict churn probability for a store."""
        features = await self._fetch_features(store_id, company_id)
        store_name = features.pop("store_name", "")

        if self._model is not None and self._scaler is not None:
            feature_vector = np.array(
                [[features.get(f, 0) for f in self.FEATURE_NAMES]]
            )
            scaled = self._scaler.transform(feature_vector)
            churn_prob = float(self._model.predict_proba(scaled)[0][1])
        else:
            churn_prob = self._rule_based_churn(features)

        # Risk level
        if churn_prob >= 0.8:
            risk_level = "critical"
        elif churn_prob >= 0.6:
            risk_level = "high"
        elif churn_prob >= 0.35:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Contributing factors
        factors = self._identify_factors(features, churn_prob)

        # Recommended actions
        actions = self._recommend_actions(features, risk_level)

        return AttritionPrediction(
            store_id=store_id,
            store_name=store_name,
            churn_probability=round(churn_prob, 3),
            risk_level=risk_level,
            contributing_factors=factors,
            recommended_actions=actions,
        )

    def _rule_based_churn(self, features: dict[str, Any]) -> float:
        """Heuristic churn scoring when no model is available."""
        score = 0.2  # baseline

        days_since_order = features.get("days_since_last_order", 0)
        if days_since_order > 30:
            score += 0.3
        elif days_since_order > 14:
            score += 0.15
        elif days_since_order > 7:
            score += 0.05

        freq_trend = features.get("frequency_trend", 1)
        if freq_trend < 0.5:
            score += 0.2
        elif freq_trend < 0.8:
            score += 0.1

        aov_trend = features.get("aov_trend", 1)
        if aov_trend < 0.7:
            score += 0.15

        if features.get("visit_count_30d", 0) == 0:
            score += 0.1

        return min(1.0, max(0.0, score))

    def _identify_factors(
        self, features: dict[str, Any], churn_prob: float
    ) -> list[str]:
        """Identify the top factors contributing to churn risk."""
        factors: list[str] = []

        days_since = features.get("days_since_last_order", 0)
        if days_since > 14:
            factors.append(f"No order in {days_since:.0f} days")

        freq_trend = features.get("frequency_trend", 1)
        if freq_trend < 0.7:
            factors.append(f"Order frequency dropped {(1 - freq_trend) * 100:.0f}%")

        aov_trend = features.get("aov_trend", 1)
        if aov_trend < 0.8:
            factors.append(f"Average order value declined {(1 - aov_trend) * 100:.0f}%")

        visits = features.get("visit_count_30d", 0)
        if visits == 0:
            factors.append("No rep visits in 30 days")
        elif visits < 2:
            factors.append(f"Only {visits:.0f} rep visit(s) in 30 days")

        task_rate = features.get("task_completion_rate", 1)
        if task_rate < 0.5:
            factors.append(f"Low task completion rate ({task_rate * 100:.0f}%)")

        if not factors and churn_prob > 0.5:
            factors.append("Multiple weak signals indicate declining engagement")

        return factors

    def _recommend_actions(
        self, features: dict[str, Any], risk_level: str
    ) -> list[str]:
        """Recommend intervention actions based on risk level."""
        actions: list[str] = []

        if risk_level in ("critical", "high"):
            actions.append("Schedule urgent store visit by senior rep or manager")
            actions.append("Offer a targeted discount or free goods promotion")

        if features.get("days_since_last_order", 0) > 14:
            actions.append("Send reactivation WhatsApp message with personalized offers")

        if features.get("visit_count_30d", 0) < 2:
            actions.append("Increase visit frequency to at least weekly")

        if features.get("msl_compliance_rate", 1) < 0.6:
            actions.append("Review MSL gaps and discuss stocking opportunities")

        if features.get("aov_trend", 1) < 0.8:
            actions.append("Investigate competitor activity in the area")

        if risk_level == "critical":
            actions.append("Escalate to territory manager for personal follow-up")

        return actions

    async def _fetch_features(
        self, store_id: str, company_id: str | None = None
    ) -> dict[str, Any]:
        """Compute attrition prediction features from the database."""
        features: dict[str, Any] = {f: 0.0 for f in self.FEATURE_NAMES}
        features["store_name"] = ""

        if self._db is None:
            return features

        params: dict[str, Any] = {"store_id": store_id}
        company_filter = ""
        if company_id:
            params["company_id"] = company_id
            company_filter = "AND t.company_id = :company_id"

        # Store name and credit tier
        try:
            store_result = await self._db.execute(
                text("SELECT name, credit_tier FROM stores WHERE id = :store_id AND deleted_at IS NULL"),
                {"store_id": store_id},
            )
            store_row = store_result.mappings().first()
            if store_row:
                features["store_name"] = store_row["name"]
                tier_map = {"A": 4, "B": 3, "C": 2, "D": 1}
                features["credit_tier_numeric"] = tier_map.get(
                    str(store_row.get("credit_tier", "B")), 3
                )
        except Exception:
            pass

        # Order patterns
        for period, suffix in [(30, "30d"), (60, "60d"), (90, "90d")]:
            try:
                query = text(f"""
                    SELECT
                        COUNT(*) as order_count,
                        COALESCE(AVG(total_amount), 0) as avg_value,
                        COALESCE(SUM(total_amount), 0) as total_revenue
                    FROM transactions t
                    WHERE t.store_id = :store_id
                      {company_filter}
                      AND t.created_at >= NOW() - INTERVAL '{period} days'
                      AND t.deleted_at IS NULL
                """)
                result = await self._db.execute(query, params)
                row = result.mappings().first()
                if row:
                    features[f"order_frequency_{suffix}"] = int(row["order_count"] or 0)
                    features[f"avg_order_value_{suffix}"] = float(row["avg_value"] or 0)
                    if suffix == "90d":
                        features["total_revenue_90d"] = float(row["total_revenue"] or 0)
            except Exception:
                pass

        # Frequency and AOV trends
        freq_90 = features.get("order_frequency_90d", 0) / 3.0  # per-month
        freq_30 = features.get("order_frequency_30d", 0)
        features["frequency_trend"] = freq_30 / max(freq_90, 0.1)

        aov_90 = features.get("avg_order_value_90d", 0)
        aov_30 = features.get("avg_order_value_30d", 0)
        features["aov_trend"] = aov_30 / max(aov_90, 0.1)

        # Days since last order
        try:
            last_order_query = text(f"""
                SELECT MAX(created_at) as last_order
                FROM transactions t
                WHERE t.store_id = :store_id {company_filter}
                  AND t.deleted_at IS NULL
            """)
            lo_result = await self._db.execute(last_order_query, params)
            lo_row = lo_result.mappings().first()
            if lo_row and lo_row["last_order"]:
                features["days_since_last_order"] = (
                    datetime.now(timezone.utc) - lo_row["last_order"]
                ).days
        except Exception:
            features["days_since_last_order"] = 999

        # Days since last visit
        try:
            lv_query = text(f"""
                SELECT MAX(check_in_at) as last_visit
                FROM visits
                WHERE store_id = :store_id
                  {company_filter.replace('t.company_id', 'company_id')}
                  AND deleted_at IS NULL
            """)
            lv_result = await self._db.execute(lv_query, params)
            lv_row = lv_result.mappings().first()
            if lv_row and lv_row["last_visit"]:
                features["days_since_last_visit"] = (
                    datetime.now(timezone.utc) - lv_row["last_visit"]
                ).days
        except Exception:
            features["days_since_last_visit"] = 999

        # Visit count in last 30 days
        try:
            vc_query = text(f"""
                SELECT COUNT(*) as visit_count
                FROM visits
                WHERE store_id = :store_id
                  {company_filter.replace('t.company_id', 'company_id')}
                  AND check_in_at >= NOW() - INTERVAL '30 days'
                  AND deleted_at IS NULL
            """)
            vc_result = await self._db.execute(vc_query, params)
            vc_row = vc_result.mappings().first()
            if vc_row:
                features["visit_count_30d"] = int(vc_row["visit_count"] or 0)
        except Exception:
            pass

        # Relationship duration
        try:
            rel_query = text(f"""
                SELECT MIN(created_at) as first_order
                FROM transactions t
                WHERE t.store_id = :store_id {company_filter}
                  AND t.deleted_at IS NULL
            """)
            rel_result = await self._db.execute(rel_query, params)
            rel_row = rel_result.mappings().first()
            if rel_row and rel_row["first_order"]:
                features["relationship_months"] = (
                    datetime.now(timezone.utc) - rel_row["first_order"]
                ).days / 30.0
        except Exception:
            pass

        return features

    def _save_model(self) -> None:
        try:
            self._model_dir.mkdir(parents=True, exist_ok=True)
            if self._model:
                with open(self._model_dir / "attrition_lr.pkl", "wb") as f:
                    pickle.dump(self._model, f)
            if self._scaler:
                with open(self._model_dir / "attrition_scaler.pkl", "wb") as f:
                    pickle.dump(self._scaler, f)
        except Exception:
            logger.warning("Failed to save attrition model.")

    def _load_model(self) -> None:
        try:
            model_path = self._model_dir / "attrition_lr.pkl"
            scaler_path = self._model_dir / "attrition_scaler.pkl"
            if model_path.exists() and scaler_path.exists():
                with open(model_path, "rb") as f:
                    self._model = pickle.load(f)  # noqa: S301
                with open(scaler_path, "rb") as f:
                    self._scaler = pickle.load(f)  # noqa: S301
                logger.info("Attrition model loaded from disk.")
        except Exception:
            logger.debug("No pre-trained attrition model found.")
