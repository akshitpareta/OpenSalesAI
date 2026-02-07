"""
Pytest fixtures for the AI service test suite.

Provides mock database sessions, mock Qdrant clients, mock Ollama responses,
and shared test data for consistent unit testing.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.config import Settings
from app.rag.pipeline import RAGPipeline
from app.rag.retriever import QdrantRetriever, RetrievedDocument


# ── Settings Fixture ──────────────────────────────────────────────────────────


@pytest.fixture()
def test_settings() -> Settings:
    """Return a Settings instance with safe test defaults."""
    return Settings(
        ENVIRONMENT="development",
        DEBUG=True,
        DATABASE_URL="postgresql+asyncpg://test:test@localhost:5432/test",
        REDIS_URL="redis://localhost:6379/1",
        QDRANT_URL="http://localhost:6333",
        OLLAMA_BASE_URL="http://localhost:11434",
        DEFAULT_MODEL="llama3.1:8b",
        FAST_MODEL="llama3.1:8b",
        ANTHROPIC_API_KEY=None,
        OPENAI_API_KEY=None,
        EMBEDDING_DEVICE="cpu",
        WHISPER_DEVICE="cpu",
        TASK_HISTORY_DAYS=90,
        TASK_MAX_PER_REP=15,
        TASK_MIN_PRIORITY=20,
    )


# ── Mock Database Session ─────────────────────────────────────────────────────


class MockMappingRow:
    """Simulates a SQLAlchemy Row that supports dict-style access."""

    def __init__(self, data: dict[str, Any]) -> None:
        self._data = data

    def __getitem__(self, key: str) -> Any:
        return self._data[key]

    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key, default)

    def keys(self) -> list[str]:
        return list(self._data.keys())

    def items(self) -> list[tuple[str, Any]]:
        return list(self._data.items())


class MockMappingsResult:
    """Simulates the result of `result.mappings()`."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = [MockMappingRow(r) for r in rows]

    def first(self) -> MockMappingRow | None:
        return self._rows[0] if self._rows else None

    def all(self) -> list[MockMappingRow]:
        return self._rows


class MockExecuteResult:
    """Simulates a SQLAlchemy execute result."""

    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self._rows = rows or []

    def mappings(self) -> MockMappingsResult:
        return MockMappingsResult(self._rows)


@pytest.fixture()
def mock_db() -> AsyncMock:
    """Create a mock async database session."""
    db = AsyncMock()

    # Default: empty results for any query
    db.execute.return_value = MockExecuteResult([])

    return db


# ── Mock Qdrant Client ────────────────────────────────────────────────────────


@pytest.fixture()
def mock_qdrant_retriever() -> MagicMock:
    """Create a mock Qdrant retriever that returns sample documents."""
    retriever = MagicMock(spec=QdrantRetriever)

    retriever.search.return_value = [
        RetrievedDocument(
            content="Store Sharma General Store is a high-frequency GT outlet in South Mumbai. "
            "Known for good snack sales. Owner is responsive to promotions.",
            metadata={
                "store_id": "store-001",
                "company_id": "company-001",
                "channel": "GT",
                "city": "Mumbai",
            },
            score=0.92,
        ),
        RetrievedDocument(
            content="Sales playbook: For stores with >14 days since last order, "
            "offer a volume-based discount (5% on 2+ cases). Focus on reactivation.",
            metadata={
                "type": "playbook",
                "topic": "reactivation",
            },
            score=0.85,
        ),
    ]

    return retriever


# ── Mock RAG Pipeline ─────────────────────────────────────────────────────────


@pytest.fixture()
def mock_rag_pipeline(
    mock_qdrant_retriever: MagicMock, test_settings: Settings
) -> RAGPipeline:
    """Create a RAG pipeline with mocked retriever and LLM calls."""
    pipeline = RAGPipeline(
        retriever=mock_qdrant_retriever,
        settings=test_settings,
    )
    return pipeline


# ── Mock Ollama Response ──────────────────────────────────────────────────────


@pytest.fixture()
def mock_ollama_response() -> dict[str, Any]:
    """Standard mock response from Ollama API."""
    return {
        "response": '[{"action": "Visit Sharma General Store and push Maggi Noodles", '
        '"reasoning": "Store has not ordered in 18 days. Maggi is a top seller.", '
        '"priority": 85, "task_type": "reactivation", '
        '"product_ids": ["prod-001"], "product_names": ["Maggi Noodles 70g"], '
        '"estimated_impact_inr": 1200.0, '
        '"suggested_pitch": "We have a special 5% volume discount on Maggi this week."}]',
        "model": "llama3.1:8b",
        "done": True,
    }


# ── Sample Store Data ─────────────────────────────────────────────────────────


@pytest.fixture()
def sample_store_data() -> dict[str, Any]:
    """Sample store record as returned from a DB query."""
    return {
        "id": "store-001",
        "name": "Sharma General Store",
        "channel": "GT",
        "city": "Mumbai",
        "state": "Maharashtra",
        "lat": 19.076,
        "lng": 72.8777,
        "credit_tier": "A",
    }


@pytest.fixture()
def sample_rep_data() -> dict[str, Any]:
    """Sample rep record as returned from a DB query."""
    return {
        "id": "rep-001",
        "name": "Rajesh Kumar",
        "phone": "+919876543210",
        "territory_id": "territory-001",
        "skill_tier": "A",
        "points_balance": 450,
    }


@pytest.fixture()
def sample_transaction_summary() -> dict[str, Any]:
    """Sample transaction summary aggregation."""
    return {
        "order_count": 12,
        "total_revenue": 45000.0,
        "avg_order_value": 3750.0,
        "last_order_date": None,  # Will be set in tests
    }
