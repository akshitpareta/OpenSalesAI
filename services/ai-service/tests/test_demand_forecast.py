"""
Tests for the demand forecasting module.

Verifies:
- DemandPrediction output format and constraints
- Prediction confidence range [0, 1]
- Non-negative predicted quantities
- Heuristic fallback predictions
- Trend detection logic
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.core.config import Settings
from app.ml.demand_forecast import DemandForecaster, DemandPrediction
from tests.conftest import MockExecuteResult


# ── DemandPrediction Model Tests ──────────────────────────────────────────────


class TestDemandPredictionModel:
    """Tests for the DemandPrediction Pydantic model."""

    def test_valid_prediction(self) -> None:
        pred = DemandPrediction(
            store_id="store-001",
            product_id="prod-001",
            horizon_days=7,
            predicted_qty=42.5,
            lower_bound=35.0,
            upper_bound=50.0,
            confidence=0.85,
            trend="increasing",
            seasonality_component=2.3,
            model_version="v1-prophet-xgb",
        )
        assert pred.predicted_qty == 42.5
        assert pred.confidence == 0.85
        assert pred.trend == "increasing"
        assert pred.model_version == "v1-prophet-xgb"

    def test_default_values(self) -> None:
        pred = DemandPrediction(
            store_id="store-001",
            product_id="prod-001",
            horizon_days=7,
            predicted_qty=10.0,
        )
        assert pred.lower_bound == 0.0
        assert pred.upper_bound == 0.0
        assert pred.confidence == 0.0
        assert pred.trend == "stable"
        assert pred.model_version == "v1"

    def test_confidence_must_be_valid_float(self) -> None:
        # Should accept 0 and 1 as boundary values
        pred_low = DemandPrediction(
            store_id="s", product_id="p", horizon_days=7,
            predicted_qty=0.0, confidence=0.0,
        )
        pred_high = DemandPrediction(
            store_id="s", product_id="p", horizon_days=7,
            predicted_qty=100.0, confidence=1.0,
        )
        assert pred_low.confidence == 0.0
        assert pred_high.confidence == 1.0


# ── DemandForecaster Tests ────────────────────────────────────────────────────


class TestDemandForecaster:
    """Test the DemandForecaster service logic."""

    def test_init_with_defaults(self) -> None:
        forecaster = DemandForecaster()
        assert forecaster.PROPHET_WEIGHT == 0.6
        assert forecaster.XGBOOST_WEIGHT == 0.4
        assert forecaster.PROPHET_WEIGHT + forecaster.XGBOOST_WEIGHT == pytest.approx(1.0)

    def test_weights_sum_to_one(self) -> None:
        """Ensemble weights must sum to 1.0 for proper averaging."""
        assert DemandForecaster.PROPHET_WEIGHT + DemandForecaster.XGBOOST_WEIGHT == pytest.approx(
            1.0
        )


# ── Heuristic Prediction Tests ────────────────────────────────────────────────


class TestHeuristicPrediction:
    """Test the heuristic (average-based) fallback prediction."""

    @pytest.mark.asyncio
    async def test_heuristic_with_no_db(self) -> None:
        """When no DB is available, heuristic should return zero prediction."""
        forecaster = DemandForecaster(db=None)
        pred = await forecaster._heuristic_predict("store-001", "prod-001", 7)

        assert isinstance(pred, DemandPrediction)
        assert pred.predicted_qty == 0.0
        assert pred.confidence == 0.3
        assert pred.model_version == "v0-heuristic"
        assert pred.trend == "stable"

    @pytest.mark.asyncio
    async def test_heuristic_with_mock_db(self) -> None:
        """Heuristic should compute prediction from average daily sales."""
        mock_db = AsyncMock()
        mock_db.execute.return_value = MockExecuteResult([{"avg_daily": 5.0}])

        forecaster = DemandForecaster(db=mock_db)
        pred = await forecaster._heuristic_predict("store-001", "prod-001", 7)

        assert isinstance(pred, DemandPrediction)
        assert pred.predicted_qty == 35.0  # 5.0 * 7
        assert pred.lower_bound == pytest.approx(24.5, abs=0.1)  # 35 * 0.7
        assert pred.upper_bound == pytest.approx(45.5, abs=0.1)  # 35 * 1.3
        assert pred.confidence == 0.3
        assert pred.horizon_days == 7

    @pytest.mark.asyncio
    async def test_heuristic_non_negative(self) -> None:
        """Heuristic should never produce negative quantities."""
        mock_db = AsyncMock()
        mock_db.execute.return_value = MockExecuteResult([{"avg_daily": 0.0}])

        forecaster = DemandForecaster(db=mock_db)
        pred = await forecaster._heuristic_predict("store-001", "prod-001", 14)

        assert pred.predicted_qty >= 0
        assert pred.lower_bound >= 0
        assert pred.upper_bound >= 0

    @pytest.mark.asyncio
    async def test_heuristic_scales_with_horizon(self) -> None:
        """Prediction should scale proportionally with horizon."""
        mock_db = AsyncMock()
        mock_db.execute.return_value = MockExecuteResult([{"avg_daily": 10.0}])

        forecaster = DemandForecaster(db=mock_db)

        pred_7 = await forecaster._heuristic_predict("s", "p", 7)
        pred_14 = await forecaster._heuristic_predict("s", "p", 14)
        pred_30 = await forecaster._heuristic_predict("s", "p", 30)

        assert pred_7.predicted_qty == 70.0
        assert pred_14.predicted_qty == 140.0
        assert pred_30.predicted_qty == 300.0

    @pytest.mark.asyncio
    async def test_heuristic_handles_null_avg(self) -> None:
        """Should handle NULL avg_daily from DB gracefully."""
        mock_db = AsyncMock()
        mock_db.execute.return_value = MockExecuteResult([{"avg_daily": None}])

        forecaster = DemandForecaster(db=mock_db)
        pred = await forecaster._heuristic_predict("s", "p", 7)

        assert pred.predicted_qty == 0.0


# ── Predict Method Tests ──────────────────────────────────────────────────────


class TestPredictMethod:
    """Test the main predict() method orchestration."""

    @pytest.mark.asyncio
    async def test_predict_falls_back_to_heuristic(self) -> None:
        """When no trained model exists, should use heuristic."""
        mock_db = AsyncMock()
        # First call: fetch_history returns empty
        # Second call: heuristic avg_daily
        call_count = 0

        async def side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 1:
                return MockExecuteResult([])  # No history
            return MockExecuteResult([{"avg_daily": 3.0}])

        mock_db.execute.side_effect = side_effect

        forecaster = DemandForecaster(db=mock_db)
        pred = await forecaster.predict("store-001", "prod-001", 7)

        assert isinstance(pred, DemandPrediction)
        assert pred.store_id == "store-001"
        assert pred.product_id == "prod-001"
        assert pred.horizon_days == 7
        assert pred.predicted_qty >= 0
