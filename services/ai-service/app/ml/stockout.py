"""
Stock-out prediction using Random Forest.

Predicts the probability of a stock-out event for each store-SKU
combination based on current inventory levels, consumption rates,
lead times, and temporal features. Generates proactive alerts
for the distributor.
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
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class StockoutPrediction(BaseModel):
    """Stock-out risk prediction for a store-SKU pair."""

    store_id: str
    product_id: str
    store_name: str = ""
    product_name: str = ""
    probability: float = Field(ge=0.0, le=1.0)
    days_until_stockout: float = 999.0
    current_stock: float = 0.0
    avg_daily_consumption: float = 0.0
    lead_time_days: float = 3.0
    suggested_reorder_qty: float = 0.0
    risk_level: str = "low"  # low, medium, high, critical
    factors: list[str] = Field(default_factory=list)


class StockoutScanResult(BaseModel):
    """Result of scanning all store-SKUs for stockout risk."""

    company_id: str
    total_scanned: int = 0
    alerts: list[StockoutPrediction] = Field(default_factory=list)
    scan_duration_seconds: float = 0.0
    scanned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StockoutPredictor:
    """Random Forest classifier for predicting stock-out events."""

    FEATURE_NAMES = [
        "current_stock",
        "avg_daily_consumption",
        "consumption_variance",
        "lead_time_days",
        "day_of_week",
        "day_of_month",
        "month",
        "is_weekend",
        "days_since_last_restock",
        "order_frequency_30d",
        "stock_to_consumption_ratio",
        "trend_slope",
    ]

    def __init__(
        self,
        db: AsyncSession | None = None,
        settings: Settings | None = None,
        model_dir: str | None = None,
    ) -> None:
        self._db = db
        self._settings = settings or get_settings()
        self._model_dir = Path(model_dir) if model_dir else Path("/app/models/stockout")
        self._model: RandomForestClassifier | None = None
        self._scaler: StandardScaler | None = None
        self._load_model()

    def train(self, training_df: pd.DataFrame) -> dict[str, Any]:
        """Train the stockout prediction model.

        Args:
            training_df: DataFrame with columns matching ``FEATURE_NAMES``
                         plus a binary ``stockout`` target column.

        Returns:
            Training metrics dict.
        """
        from sklearn.metrics import classification_report, roc_auc_score
        from sklearn.model_selection import train_test_split

        df = training_df.copy()

        # Ensure all features present
        for col in self.FEATURE_NAMES:
            if col not in df.columns:
                df[col] = 0

        X = df[self.FEATURE_NAMES].values
        y = df["stockout"].values.astype(int)

        # Handle class imbalance
        n_positive = y.sum()
        n_negative = len(y) - n_positive
        scale_pos_weight = n_negative / max(n_positive, 1)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        self._scaler = StandardScaler()
        X_train_scaled = self._scaler.fit_transform(X_train)
        X_test_scaled = self._scaler.transform(X_test)

        self._model = RandomForestClassifier(
            n_estimators=300,
            max_depth=12,
            min_samples_split=5,
            min_samples_leaf=2,
            class_weight={0: 1, 1: scale_pos_weight},
            random_state=42,
            n_jobs=-1,
        )
        self._model.fit(X_train_scaled, y_train)

        # Evaluate
        y_pred = self._model.predict(X_test_scaled)
        y_proba = self._model.predict_proba(X_test_scaled)[:, 1]
        auc = roc_auc_score(y_test, y_proba) if len(set(y_test)) > 1 else 0.0
        report = classification_report(y_test, y_pred, output_dict=True)

        # Feature importances
        importances = dict(
            zip(self.FEATURE_NAMES, self._model.feature_importances_, strict=True)
        )

        # Save
        self._save_model()

        metrics = {
            "status": "trained",
            "samples": len(training_df),
            "auc_roc": round(auc, 4),
            "precision": round(report.get("1", {}).get("precision", 0), 4),
            "recall": round(report.get("1", {}).get("recall", 0), 4),
            "f1_score": round(report.get("1", {}).get("f1-score", 0), 4),
            "feature_importances": {
                k: round(v, 4) for k, v in sorted(importances.items(), key=lambda x: -x[1])
            },
        }
        logger.info("Stockout model trained: AUC=%.4f, F1=%.4f", auc, metrics["f1_score"])
        return metrics

    async def predict(
        self, store_id: str, product_id: str, company_id: str | None = None
    ) -> StockoutPrediction:
        """Predict stockout risk for a store-product pair.

        If no trained model is available, falls back to a rule-based heuristic
        using consumption rate and current stock.
        """
        # Fetch features from DB
        features = await self._fetch_features(store_id, product_id, company_id)

        # Get store/product names
        store_name = features.pop("store_name", "")
        product_name = features.pop("product_name", "")

        current_stock = features.get("current_stock", 0)
        avg_daily = features.get("avg_daily_consumption", 0)
        lead_time = features.get("lead_time_days", 3)

        if self._model is not None and self._scaler is not None:
            # Use trained model
            feature_vector = np.array(
                [[features.get(f, 0) for f in self.FEATURE_NAMES]]
            )
            scaled = self._scaler.transform(feature_vector)
            probability = float(self._model.predict_proba(scaled)[0][1])
        else:
            # Rule-based fallback
            if avg_daily <= 0:
                probability = 0.1
            elif current_stock <= 0:
                probability = 0.95
            else:
                days_of_stock = current_stock / avg_daily
                if days_of_stock <= lead_time:
                    probability = 0.9
                elif days_of_stock <= lead_time * 2:
                    probability = 0.6
                elif days_of_stock <= lead_time * 3:
                    probability = 0.3
                else:
                    probability = 0.1

        # Days until stockout
        days_until = (current_stock / avg_daily) if avg_daily > 0 else 999.0

        # Suggested reorder quantity (cover next 14 days + buffer)
        safety_stock = avg_daily * lead_time * 1.5
        suggested_qty = max(0, (avg_daily * 14 + safety_stock) - current_stock)

        # Risk level
        if probability >= 0.8:
            risk_level = "critical"
        elif probability >= 0.6:
            risk_level = "high"
        elif probability >= 0.4:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Contributing factors
        factors: list[str] = []
        if current_stock <= 0:
            factors.append("Zero current stock")
        if days_until <= lead_time:
            factors.append(f"Stock covers only {days_until:.1f} days (lead time: {lead_time} days)")
        if features.get("consumption_variance", 0) > avg_daily * 0.5:
            factors.append("High consumption variance — demand is unpredictable")
        if features.get("trend_slope", 0) > 0:
            factors.append("Consumption trend is increasing")
        if features.get("days_since_last_restock", 0) > 14:
            factors.append(f"No restock in {features.get('days_since_last_restock', 0):.0f} days")

        return StockoutPrediction(
            store_id=store_id,
            product_id=product_id,
            store_name=store_name,
            product_name=product_name,
            probability=round(probability, 3),
            days_until_stockout=round(days_until, 1),
            current_stock=round(current_stock, 1),
            avg_daily_consumption=round(avg_daily, 2),
            lead_time_days=lead_time,
            suggested_reorder_qty=round(suggested_qty, 0),
            risk_level=risk_level,
            factors=factors,
        )

    async def scan_all(self, company_id: str) -> StockoutScanResult:
        """Scan all store-SKU combinations for stockout risk.

        Returns only items above the configured probability threshold.
        """
        import time

        start = time.monotonic()
        result = StockoutScanResult(company_id=company_id)

        if self._db is None:
            return result

        # Get all active store-product combos with recent activity
        query = text("""
            SELECT DISTINCT t.store_id, ti.product_id
            FROM transaction_items ti
            INNER JOIN transactions t ON t.id = ti.transaction_id
            WHERE t.company_id = :company_id
              AND t.created_at >= NOW() - INTERVAL '60 days'
              AND t.deleted_at IS NULL
            LIMIT :limit
        """)
        rows = await self._db.execute(
            query,
            {
                "company_id": company_id,
                "limit": self._settings.STOCKOUT_SCAN_BATCH_SIZE * 100,
            },
        )
        combos = rows.mappings().all()
        result.total_scanned = len(combos)

        for combo in combos:
            try:
                pred = await self.predict(
                    store_id=str(combo["store_id"]),
                    product_id=str(combo["product_id"]),
                    company_id=company_id,
                )
                if pred.probability >= self._settings.STOCKOUT_THRESHOLD:
                    result.alerts.append(pred)
            except Exception:
                logger.warning(
                    "Stockout prediction failed for store=%s product=%s.",
                    combo["store_id"],
                    combo["product_id"],
                )

        # Sort by probability descending
        result.alerts.sort(key=lambda a: a.probability, reverse=True)
        result.scan_duration_seconds = round(time.monotonic() - start, 2)
        result.scanned_at = datetime.now(timezone.utc)

        logger.info(
            "Stockout scan: %d scanned, %d alerts (threshold=%.1f%%), %.1fs.",
            result.total_scanned,
            len(result.alerts),
            self._settings.STOCKOUT_THRESHOLD * 100,
            result.scan_duration_seconds,
        )
        return result

    # ── Private ───────────────────────────────────────────────────────

    async def _fetch_features(
        self, store_id: str, product_id: str, company_id: str | None = None
    ) -> dict[str, Any]:
        """Compute stockout prediction features from the database."""
        features: dict[str, Any] = {f: 0.0 for f in self.FEATURE_NAMES}
        features["store_name"] = ""
        features["product_name"] = ""

        if self._db is None:
            return features

        now = datetime.now(timezone.utc)
        features["day_of_week"] = now.weekday()
        features["day_of_month"] = now.day
        features["month"] = now.month
        features["is_weekend"] = 1 if now.weekday() >= 5 else 0
        features["lead_time_days"] = 3.0

        # Store and product names
        try:
            name_query = text("""
                SELECT s.name as store_name, p.name as product_name
                FROM stores s, products p
                WHERE s.id = :store_id AND p.id = :product_id
            """)
            name_result = await self._db.execute(
                name_query, {"store_id": store_id, "product_id": product_id}
            )
            name_row = name_result.mappings().first()
            if name_row:
                features["store_name"] = name_row["store_name"]
                features["product_name"] = name_row["product_name"]
        except Exception:
            pass

        # Consumption data (last 60 days)
        try:
            consumption_query = text("""
                SELECT
                    DATE(t.created_at) as sale_date,
                    SUM(ti.quantity) as daily_qty
                FROM transaction_items ti
                INNER JOIN transactions t ON t.id = ti.transaction_id
                WHERE t.store_id = :store_id
                  AND ti.product_id = :product_id
                  AND t.created_at >= NOW() - INTERVAL '60 days'
                  AND t.deleted_at IS NULL
                GROUP BY DATE(t.created_at)
                ORDER BY sale_date
            """)
            consumption_result = await self._db.execute(
                consumption_query,
                {"store_id": store_id, "product_id": product_id},
            )
            consumption_rows = consumption_result.mappings().all()

            if consumption_rows:
                daily_qtys = [float(r["daily_qty"]) for r in consumption_rows]
                features["avg_daily_consumption"] = np.mean(daily_qtys)
                features["consumption_variance"] = np.std(daily_qtys)

                # Trend slope (simple linear regression)
                if len(daily_qtys) > 1:
                    x = np.arange(len(daily_qtys))
                    slope = np.polyfit(x, daily_qtys, 1)[0]
                    features["trend_slope"] = slope

                # Order frequency in last 30 days
                recent_orders = sum(1 for r in consumption_rows
                                    if (now - r["sale_date"].replace(tzinfo=timezone.utc) if hasattr(r["sale_date"], 'replace') else timedelta(days=0)).days <= 30)
                features["order_frequency_30d"] = recent_orders
        except Exception:
            logger.warning("Failed to fetch consumption data for %s/%s.", store_id, product_id)

        # Current stock (from latest inventory record if available)
        try:
            stock_query = text("""
                SELECT current_stock, last_restock_at
                FROM store_inventory
                WHERE store_id = :store_id AND product_id = :product_id
                ORDER BY updated_at DESC
                LIMIT 1
            """)
            stock_result = await self._db.execute(
                stock_query, {"store_id": store_id, "product_id": product_id}
            )
            stock_row = stock_result.mappings().first()
            if stock_row:
                features["current_stock"] = float(stock_row["current_stock"] or 0)
                if stock_row["last_restock_at"]:
                    features["days_since_last_restock"] = (
                        now - stock_row["last_restock_at"]
                    ).days
        except Exception:
            # store_inventory table may not exist yet
            pass

        # Stock-to-consumption ratio
        avg_daily = features.get("avg_daily_consumption", 0)
        if avg_daily > 0:
            features["stock_to_consumption_ratio"] = features["current_stock"] / avg_daily
        else:
            features["stock_to_consumption_ratio"] = 999.0

        return features

    def _save_model(self) -> None:
        """Persist the trained model to disk."""
        try:
            self._model_dir.mkdir(parents=True, exist_ok=True)
            if self._model is not None:
                with open(self._model_dir / "stockout_rf.pkl", "wb") as f:
                    pickle.dump(self._model, f)
            if self._scaler is not None:
                with open(self._model_dir / "stockout_scaler.pkl", "wb") as f:
                    pickle.dump(self._scaler, f)
        except Exception:
            logger.warning("Failed to save stockout model.")

    def _load_model(self) -> None:
        """Load a previously trained model from disk."""
        try:
            model_path = self._model_dir / "stockout_rf.pkl"
            scaler_path = self._model_dir / "stockout_scaler.pkl"

            if model_path.exists() and scaler_path.exists():
                with open(model_path, "rb") as f:
                    self._model = pickle.load(f)  # noqa: S301
                with open(scaler_path, "rb") as f:
                    self._scaler = pickle.load(f)  # noqa: S301
                logger.info("Stockout model loaded from disk.")
        except Exception:
            logger.debug("No pre-trained stockout model found.")
