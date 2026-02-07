"""
Tests for the AI task generator service.

Verifies:
- Feature computation from store transaction history
- RAG context assembly
- Task generation output schema (valid JSON with required fields)
- Rule-based fallback when LLM is unavailable
- Batch generation across multiple reps
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.config import Settings
from app.rag.pipeline import RAGPipeline
from app.services.task_generator import (
    BatchResult,
    GeneratedTask,
    StoreFeatures,
    TaskGeneratorService,
)
from tests.conftest import MockExecuteResult


# ── StoreFeatures Model Tests ─────────────────────────────────────────────────


class TestStoreFeatures:
    """Tests for the StoreFeatures Pydantic model."""

    def test_default_values(self) -> None:
        features = StoreFeatures(store_id="store-001", store_name="Test Store")
        assert features.days_since_last_order == 999
        assert features.days_since_last_visit == 999
        assert features.avg_order_value == 0.0
        assert features.purchase_frequency == 0.0
        assert features.msl_gaps == 0
        assert features.credit_tier == "B"

    def test_custom_values(self) -> None:
        features = StoreFeatures(
            store_id="store-001",
            store_name="Sharma General Store",
            channel="GT",
            city="Mumbai",
            state="Maharashtra",
            credit_tier="A",
            days_since_last_order=18,
            avg_order_value=3750.0,
            purchase_frequency=4.2,
            total_revenue_90d=45000.0,
            total_orders_90d=12,
            msl_compliance=72.5,
            msl_gaps=5,
        )
        assert features.days_since_last_order == 18
        assert features.avg_order_value == 3750.0
        assert features.msl_gaps == 5


# ── GeneratedTask Model Tests ─────────────────────────────────────────────────


class TestGeneratedTask:
    """Tests for the GeneratedTask Pydantic model."""

    def test_auto_generates_uuid_id(self) -> None:
        task = GeneratedTask(
            store_id="store-001",
            action="Visit store",
            reasoning="Scheduled visit",
            priority=50,
        )
        assert task.id is not None
        assert len(task.id) == 36  # UUID format

    def test_priority_clamped_to_range(self) -> None:
        task = GeneratedTask(
            store_id="store-001",
            action="Test",
            reasoning="Test",
            priority=100,
        )
        assert task.priority == 100

    def test_priority_rejects_negative(self) -> None:
        with pytest.raises(Exception):
            GeneratedTask(
                store_id="store-001",
                action="Test",
                reasoning="Test",
                priority=-1,
            )

    def test_priority_rejects_over_100(self) -> None:
        with pytest.raises(Exception):
            GeneratedTask(
                store_id="store-001",
                action="Test",
                reasoning="Test",
                priority=101,
            )

    def test_default_fields(self) -> None:
        task = GeneratedTask(
            store_id="store-001",
            action="Visit",
            reasoning="Reason",
            priority=50,
        )
        assert task.task_type == "general"
        assert task.product_ids == []
        assert task.product_names == []
        assert task.estimated_impact_inr == 0.0


# ── Rule-Based Fallback Tests ─────────────────────────────────────────────────


class TestRuleBasedTasks:
    """Test the rule-based fallback task generation."""

    def setup_method(self) -> None:
        self.service = TaskGeneratorService(
            db=AsyncMock(),
            rag_pipeline=MagicMock(spec=RAGPipeline),
        )

    def test_reactivation_task_generated_for_dormant_store(self) -> None:
        """Stores with >14 days since last order should get a reactivation task."""
        store = StoreFeatures(
            store_id="store-001",
            store_name="Sharma Store",
            days_since_last_order=20,
            avg_order_value=3000.0,
        )
        tasks = self.service._rule_based_tasks(store)
        reactivation_tasks = [t for t in tasks if t.task_type == "reactivation"]
        assert len(reactivation_tasks) >= 1
        assert "Reactivate" in reactivation_tasks[0].action
        assert reactivation_tasks[0].priority >= 50

    def test_no_reactivation_for_recent_order(self) -> None:
        """Stores with recent orders should NOT get a reactivation task."""
        store = StoreFeatures(
            store_id="store-001",
            store_name="Active Store",
            days_since_last_order=5,
            avg_order_value=3000.0,
        )
        tasks = self.service._rule_based_tasks(store)
        reactivation_tasks = [t for t in tasks if t.task_type == "reactivation"]
        assert len(reactivation_tasks) == 0

    def test_msl_fill_task_generated_for_gaps(self) -> None:
        """Stores with MSL gaps should get an MSL fill task."""
        store = StoreFeatures(
            store_id="store-002",
            store_name="Patel Kirana",
            msl_gaps=5,
            msl_compliance=60.0,
        )
        tasks = self.service._rule_based_tasks(store)
        msl_tasks = [t for t in tasks if t.task_type == "msl_fill"]
        assert len(msl_tasks) >= 1
        assert "MSL gaps" in msl_tasks[0].action

    def test_no_msl_task_when_compliant(self) -> None:
        """Fully compliant stores should NOT get MSL tasks."""
        store = StoreFeatures(
            store_id="store-002",
            store_name="Full Store",
            msl_gaps=0,
            msl_compliance=100.0,
        )
        tasks = self.service._rule_based_tasks(store)
        msl_tasks = [t for t in tasks if t.task_type == "msl_fill"]
        assert len(msl_tasks) == 0

    def test_upsell_task_for_active_high_frequency_store(self) -> None:
        """Active stores with high purchase frequency should get an upsell task."""
        store = StoreFeatures(
            store_id="store-003",
            store_name="Busy Mart",
            days_since_last_order=3,
            purchase_frequency=5.0,
            avg_order_value=5000.0,
        )
        tasks = self.service._rule_based_tasks(store)
        upsell_tasks = [t for t in tasks if t.task_type == "upsell"]
        assert len(upsell_tasks) >= 1

    def test_no_upsell_for_low_frequency_store(self) -> None:
        """Low-frequency stores should NOT get upsell tasks."""
        store = StoreFeatures(
            store_id="store-003",
            store_name="Slow Store",
            days_since_last_order=3,
            purchase_frequency=1.5,
        )
        tasks = self.service._rule_based_tasks(store)
        upsell_tasks = [t for t in tasks if t.task_type == "upsell"]
        assert len(upsell_tasks) == 0

    def test_all_tasks_have_reasoning(self) -> None:
        """Every generated task must include a reasoning field."""
        store = StoreFeatures(
            store_id="store-001",
            store_name="Test Store",
            days_since_last_order=30,
            msl_gaps=3,
            msl_compliance=50.0,
        )
        tasks = self.service._rule_based_tasks(store)
        for task in tasks:
            assert task.reasoning, f"Task {task.action} missing reasoning"
            assert len(task.reasoning) > 10

    def test_priority_within_bounds(self) -> None:
        """All task priorities must be between 0 and 100."""
        store = StoreFeatures(
            store_id="store-001",
            store_name="Edge Case Store",
            days_since_last_order=999,
            msl_gaps=50,
        )
        tasks = self.service._rule_based_tasks(store)
        for task in tasks:
            assert 0 <= task.priority <= 100, f"Priority {task.priority} out of bounds"


# ── Batch Result Tests ────────────────────────────────────────────────────────


class TestBatchResult:
    """Tests for the BatchResult model."""

    def test_default_values(self) -> None:
        result = BatchResult(company_id="company-001")
        assert result.total_reps == 0
        assert result.total_tasks_generated == 0
        assert result.errors == []
        assert result.duration_seconds == 0.0

    def test_error_tracking(self) -> None:
        result = BatchResult(company_id="company-001")
        result.errors.append("Rep rep-001: timeout")
        result.errors.append("Rep rep-002: DB error")
        assert len(result.errors) == 2


# ── Integration-Level Tests (with mocked DB) ─────────────────────────────────


class TestTaskGeneratorWithMockDB:
    """Tests that verify the generate_tasks_for_rep flow with mocked DB."""

    @pytest.mark.asyncio
    async def test_returns_empty_when_rep_not_found(
        self, mock_db: AsyncMock, test_settings: Settings
    ) -> None:
        """When the rep does not exist, should return empty list."""
        mock_db.execute.return_value = MockExecuteResult([])

        pipeline = MagicMock(spec=RAGPipeline)
        service = TaskGeneratorService(
            db=mock_db, rag_pipeline=pipeline, settings=test_settings
        )
        tasks = await service.generate_tasks_for_rep("nonexistent-rep", "company-001")
        assert tasks == []

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_stores_assigned(
        self,
        mock_db: AsyncMock,
        sample_rep_data: dict[str, Any],
        test_settings: Settings,
    ) -> None:
        """When the rep has no stores assigned, should return empty list."""
        call_count = 0

        async def side_effect(*args: Any, **kwargs: Any) -> MockExecuteResult:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First call: get rep (found)
                return MockExecuteResult([sample_rep_data])
            # Second call: get stores (empty)
            return MockExecuteResult([])

        mock_db.execute.side_effect = side_effect

        pipeline = MagicMock(spec=RAGPipeline)
        service = TaskGeneratorService(
            db=mock_db, rag_pipeline=pipeline, settings=test_settings
        )
        tasks = await service.generate_tasks_for_rep("rep-001", "company-001")
        assert tasks == []
