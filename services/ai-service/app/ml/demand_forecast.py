"""
Demand forecasting using Prophet + XGBoost ensemble.

Predicts future demand for a store-SKU combination over configurable
horizons (7, 14, 30 days). Prophet handles trend/seasonality while
XGBoost captures non-linear feature interactions. The final prediction
is a weighted average of both models.
"""

from __future__ import annotations

import logging
import pickle
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class DemandPrediction(BaseModel):
    """Demand forecast output for a store-SKU pair."""

    store_id: str
    product_id: str
    horizon_days: int
    predicted_qty: float
    lower_bound: float = 0.0
    upper_bound: float = 0.0
    confidence: float = 0.0
    trend: str = "stable"  # increasing, decreasing, stable
    seasonality_component: float = 0.0
    model_version: str = "v1"


class DemandForecaster:
    """Prophet + XGBoost ensemble demand forecasting engine."""

    PROPHET_WEIGHT = 0.6
    XGBOOST_WEIGHT = 0.4

    def __init__(
        self,
        db: AsyncSession | None = None,
        settings: Settings | None = None,
        model_dir: str | None = None,
    ) -> None:
        self._db = db
        self._settings = settings or get_settings()
        self._model_dir = Path(model_dir) if model_dir else Path("/app/models/demand")
        self._prophet_models: dict[str, Any] = {}
        self._xgb_models: dict[str, Any] = {}

    # ── Training ──────────────────────────────────────────────────────

    def train(
        self,
        store_id: str,
        product_id: str,
        history_df: pd.DataFrame,
    ) -> dict[str, Any]:
        """Train Prophet + XGBoost models on historical transaction data.

        Args:
            store_id: The store UUID.
            product_id: The product UUID.
            history_df: DataFrame with columns: ds (date), y (quantity),
                        and optional features (day_of_week, month, promo, etc.)

        Returns:
            Dict with training metrics.
        """
        from prophet import Prophet
        from xgboost import XGBRegressor

        key = f"{store_id}_{product_id}"

        if len(history_df) < 14:
            logger.warning(
                "Insufficient data for %s (%d rows). Need at least 14.",
                key,
                len(history_df),
            )
            return {"status": "skipped", "reason": "insufficient_data", "rows": len(history_df)}

        # Ensure correct column names for Prophet
        df = history_df.copy()
        if "ds" not in df.columns and "date" in df.columns:
            df = df.rename(columns={"date": "ds"})
        if "y" not in df.columns and "quantity" in df.columns:
            df = df.rename(columns={"quantity": "y"})

        df["ds"] = pd.to_datetime(df["ds"])
        df = df.sort_values("ds").reset_index(drop=True)

        # ── Prophet ───────────────────────────────────────────────────
        prophet_df = df[["ds", "y"]].copy()

        prophet_model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10.0,
            interval_width=0.80,
        )

        # Add Indian holiday calendar
        prophet_model.add_country_holidays(country_name="IN")

        prophet_model.fit(prophet_df)
        self._prophet_models[key] = prophet_model

        # ── XGBoost ───────────────────────────────────────────────────
        xgb_df = df.copy()
        xgb_df["day_of_week"] = xgb_df["ds"].dt.dayofweek
        xgb_df["month"] = xgb_df["ds"].dt.month
        xgb_df["day_of_month"] = xgb_df["ds"].dt.day
        xgb_df["week_of_year"] = xgb_df["ds"].dt.isocalendar().week.astype(int)
        xgb_df["is_weekend"] = (xgb_df["day_of_week"] >= 5).astype(int)

        # Lag features
        for lag in [1, 3, 7, 14]:
            xgb_df[f"lag_{lag}"] = xgb_df["y"].shift(lag)

        # Rolling averages
        for window in [7, 14, 30]:
            xgb_df[f"rolling_mean_{window}"] = (
                xgb_df["y"].rolling(window=window, min_periods=1).mean()
            )
            xgb_df[f"rolling_std_{window}"] = (
                xgb_df["y"].rolling(window=window, min_periods=1).std().fillna(0)
            )

        xgb_df = xgb_df.dropna().reset_index(drop=True)

        feature_cols = [
            "day_of_week", "month", "day_of_month", "week_of_year", "is_weekend",
            "lag_1", "lag_3", "lag_7", "lag_14",
            "rolling_mean_7", "rolling_mean_14", "rolling_mean_30",
            "rolling_std_7", "rolling_std_14", "rolling_std_30",
        ]

        # Add any extra features from the original DataFrame
        for col in df.columns:
            if col not in ("ds", "y", "date", "quantity") and col in xgb_df.columns:
                feature_cols.append(col)

        available_features = [c for c in feature_cols if c in xgb_df.columns]

        X = xgb_df[available_features].values
        y_vals = xgb_df["y"].values

        xgb_model = XGBRegressor(
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

        xgb_model.fit(X, y_vals, verbose=False)
        self._xgb_models[key] = {
            "model": xgb_model,
            "feature_cols": available_features,
            "last_values": xgb_df.iloc[-1].to_dict(),
            "history_df": xgb_df.tail(30).copy(),
        }

        # Save models
        self._save_model(key)

        logger.info(
            "Trained demand model for %s — %d data points.", key, len(df)
        )

        return {
            "status": "trained",
            "key": key,
            "data_points": len(df),
            "date_range": f"{df['ds'].min()} to {df['ds'].max()}",
        }

    # ── Prediction ────────────────────────────────────────────────────

    async def predict(
        self,
        store_id: str,
        product_id: str,
        horizon_days: int = 7,
    ) -> DemandPrediction:
        """Predict demand for a store-SKU pair.

        Args:
            store_id: Store UUID.
            product_id: Product UUID.
            horizon_days: Forecast horizon (7, 14, or 30 days).

        Returns:
            ``DemandPrediction`` with quantity, bounds, and trend.
        """
        key = f"{store_id}_{product_id}"

        # Try loading models if not in memory
        if key not in self._prophet_models:
            self._load_model(key)

        # If still no model, try training from DB
        if key not in self._prophet_models and self._db is not None:
            history = await self._fetch_history(store_id, product_id)
            if len(history) >= 14:
                self.train(store_id, product_id, history)

        # If no model available, return a simple heuristic prediction
        if key not in self._prophet_models:
            return await self._heuristic_predict(store_id, product_id, horizon_days)

        # ── Prophet prediction ────────────────────────────────────────
        prophet_model = self._prophet_models[key]
        future = prophet_model.make_future_dataframe(periods=horizon_days, freq="D")
        forecast = prophet_model.predict(future)

        prophet_forecast = forecast.tail(horizon_days)
        prophet_qty = max(0, float(prophet_forecast["yhat"].sum()))
        prophet_lower = max(0, float(prophet_forecast["yhat_lower"].sum()))
        prophet_upper = max(0, float(prophet_forecast["yhat_upper"].sum()))

        # Trend detection
        recent_trend = forecast.tail(horizon_days + 7)["trend"]
        trend_slope = float(recent_trend.iloc[-1] - recent_trend.iloc[0])
        if trend_slope > 0.5:
            trend = "increasing"
        elif trend_slope < -0.5:
            trend = "decreasing"
        else:
            trend = "stable"

        # Seasonality component
        seasonality = float(prophet_forecast["weekly"].mean()) if "weekly" in prophet_forecast.columns else 0.0

        # ── XGBoost prediction ────────────────────────────────────────
        xgb_qty = prophet_qty  # Default to Prophet if XGBoost unavailable
        if key in self._xgb_models:
            try:
                xgb_data = self._xgb_models[key]
                xgb_model = xgb_data["model"]
                feature_cols = xgb_data["feature_cols"]
                history_df = xgb_data["history_df"]

                # Generate future features
                xgb_predictions = []
                recent = history_df.copy()

                for day in range(horizon_days):
                    future_date = datetime.now(timezone.utc) + timedelta(days=day + 1)
                    row: dict[str, Any] = {
                        "day_of_week": future_date.weekday(),
                        "month": future_date.month,
                        "day_of_month": future_date.day,
                        "week_of_year": future_date.isocalendar()[1],
                        "is_weekend": 1 if future_date.weekday() >= 5 else 0,
                    }

                    # Lag features from recent data
                    y_series = recent["y"].tolist()
                    for lag in [1, 3, 7, 14]:
                        idx = len(y_series) - lag
                        row[f"lag_{lag}"] = y_series[idx] if idx >= 0 else np.mean(y_series)

                    for window in [7, 14, 30]:
                        window_data = y_series[-window:]
                        row[f"rolling_mean_{window}"] = np.mean(window_data) if window_data else 0
                        row[f"rolling_std_{window}"] = np.std(window_data) if len(window_data) > 1 else 0

                    features = np.array([[row.get(c, 0) for c in feature_cols]])
                    pred = max(0, float(xgb_model.predict(features)[0]))
                    xgb_predictions.append(pred)

                    # Add prediction as next "actual" for lag computation
                    new_row = row.copy()
                    new_row["y"] = pred
                    recent = pd.concat(
                        [recent, pd.DataFrame([new_row])],
                        ignore_index=True,
                    )

                xgb_qty = sum(xgb_predictions)
            except Exception:
                logger.warning("XGBoost prediction failed for %s, using Prophet only.", key)

        # ── Ensemble ──────────────────────────────────────────────────
        ensemble_qty = (
            self.PROPHET_WEIGHT * prophet_qty + self.XGBOOST_WEIGHT * xgb_qty
        )

        # Confidence based on prediction interval width
        interval_width = prophet_upper - prophet_lower
        confidence = max(0, min(1, 1 - (interval_width / (ensemble_qty + 1e-6))))

        return DemandPrediction(
            store_id=store_id,
            product_id=product_id,
            horizon_days=horizon_days,
            predicted_qty=round(ensemble_qty, 1),
            lower_bound=round(prophet_lower, 1),
            upper_bound=round(prophet_upper, 1),
            confidence=round(confidence, 3),
            trend=trend,
            seasonality_component=round(seasonality, 2),
            model_version="v1-prophet-xgb",
        )

    # ── Helpers ───────────────────────────────────────────────────────

    async def _fetch_history(
        self, store_id: str, product_id: str
    ) -> pd.DataFrame:
        """Fetch transaction history from the database."""
        if self._db is None:
            return pd.DataFrame()

        query = text("""
            SELECT
                DATE(t.created_at) as ds,
                SUM(ti.quantity) as y
            FROM transaction_items ti
            INNER JOIN transactions t ON t.id = ti.transaction_id
            WHERE t.store_id = :store_id
              AND ti.product_id = :product_id
              AND t.created_at >= NOW() - INTERVAL '180 days'
              AND t.deleted_at IS NULL
            GROUP BY DATE(t.created_at)
            ORDER BY ds
        """)
        result = await self._db.execute(
            query, {"store_id": store_id, "product_id": product_id}
        )
        rows = result.mappings().all()
        if not rows:
            return pd.DataFrame()

        return pd.DataFrame([dict(r) for r in rows])

    async def _heuristic_predict(
        self, store_id: str, product_id: str, horizon_days: int
    ) -> DemandPrediction:
        """Simple average-based prediction when no model is available."""
        avg_daily = 0.0
        if self._db is not None:
            query = text("""
                SELECT COALESCE(
                    SUM(ti.quantity)::float / GREATEST(
                        EXTRACT(EPOCH FROM (MAX(t.created_at) - MIN(t.created_at))) / 86400,
                        1
                    ),
                    0
                ) as avg_daily
                FROM transaction_items ti
                INNER JOIN transactions t ON t.id = ti.transaction_id
                WHERE t.store_id = :store_id
                  AND ti.product_id = :product_id
                  AND t.created_at >= NOW() - INTERVAL '90 days'
                  AND t.deleted_at IS NULL
            """)
            result = await self._db.execute(
                query, {"store_id": store_id, "product_id": product_id}
            )
            row = result.mappings().first()
            if row:
                avg_daily = float(row["avg_daily"] or 0)

        predicted = avg_daily * horizon_days

        return DemandPrediction(
            store_id=store_id,
            product_id=product_id,
            horizon_days=horizon_days,
            predicted_qty=round(predicted, 1),
            lower_bound=round(predicted * 0.7, 1),
            upper_bound=round(predicted * 1.3, 1),
            confidence=0.3,
            trend="stable",
            model_version="v0-heuristic",
        )

    def _save_model(self, key: str) -> None:
        """Persist trained models to disk."""
        try:
            self._model_dir.mkdir(parents=True, exist_ok=True)
            if key in self._prophet_models:
                with open(self._model_dir / f"{key}_prophet.pkl", "wb") as f:
                    pickle.dump(self._prophet_models[key], f)
            if key in self._xgb_models:
                with open(self._model_dir / f"{key}_xgb.pkl", "wb") as f:
                    pickle.dump(self._xgb_models[key], f)
            logger.debug("Saved models for %s.", key)
        except Exception:
            logger.warning("Failed to save models for %s.", key)

    def _load_model(self, key: str) -> None:
        """Load pre-trained models from disk."""
        try:
            prophet_path = self._model_dir / f"{key}_prophet.pkl"
            xgb_path = self._model_dir / f"{key}_xgb.pkl"

            if prophet_path.exists():
                with open(prophet_path, "rb") as f:
                    self._prophet_models[key] = pickle.load(f)  # noqa: S301

            if xgb_path.exists():
                with open(xgb_path, "rb") as f:
                    self._xgb_models[key] = pickle.load(f)  # noqa: S301

            if key in self._prophet_models:
                logger.debug("Loaded models for %s from disk.", key)
        except Exception:
            logger.warning("Failed to load models for %s.", key)
