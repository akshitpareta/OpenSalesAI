"""
Application configuration using Pydantic BaseSettings.

All configuration is loaded from environment variables with sensible defaults
for local development. Production values should be set via .env or container env.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the AI service."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────
    APP_NAME: str = "OpenSalesAI - AI Service"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # ── Database (PostgreSQL + TimescaleDB) ──────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://opensales:opensales@localhost:5432/opensalesai"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_ECHO: bool = False

    # ── Redis ────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL: int = 3600  # seconds

    # ── Qdrant (Vector DB) ───────────────────────────────────────────────
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str | None = None
    QDRANT_COLLECTION_STORE_PROFILES: str = "store_profiles"
    QDRANT_COLLECTION_PRODUCT_CATALOG: str = "product_catalog"
    QDRANT_COLLECTION_SALES_PLAYBOOKS: str = "sales_playbooks"

    # ── MinIO (Object Storage) ───────────────────────────────────────────
    MINIO_URL: str = "http://localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_MODELS: str = "ml-models"
    MINIO_BUCKET_AUDIO: str = "audio-files"

    # ── LLM — Ollama (local) ────────────────────────────────────────────
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    DEFAULT_MODEL: str = "llama3.1:70b"
    FAST_MODEL: str = "llama3.1:8b"
    LLM_TEMPERATURE: float = 0.1
    LLM_MAX_TOKENS: int = 4096
    LLM_REQUEST_TIMEOUT: int = 120  # seconds

    # ── LLM — Cloud Fallback ────────────────────────────────────────────
    ANTHROPIC_API_KEY: str | None = None
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-4o"

    # ── Embedding ────────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384
    EMBEDDING_BATCH_SIZE: int = 64
    EMBEDDING_DEVICE: str = "cuda"  # "cuda" for GPU, "cpu" for CPU

    # ── Whisper STT ──────────────────────────────────────────────────────
    WHISPER_MODEL_SIZE: str = "large-v3"
    WHISPER_DEVICE: str = "cuda"
    WHISPER_COMPUTE_TYPE: str = "float16"
    WHISPER_DEFAULT_LANGUAGE: str = "hi"  # Hindi

    # ── Piper TTS ────────────────────────────────────────────────────────
    PIPER_MODEL_DIR: str = "/app/models/piper"
    PIPER_DEFAULT_VOICE: str = "hi_CV-male"

    # ── Keycloak Auth ────────────────────────────────────────────────────
    KEYCLOAK_URL: str = "http://localhost:8080"
    KEYCLOAK_REALM: str = "opensalesai"
    KEYCLOAK_CLIENT_ID: str = "ai-service"
    KEYCLOAK_PUBLIC_KEY: str | None = None
    AUTH_ENABLED: bool = True

    # ── MLflow ───────────────────────────────────────────────────────────
    MLFLOW_TRACKING_URI: str = "http://localhost:5000"
    MLFLOW_EXPERIMENT_NAME: str = "opensalesai"

    # ── Task Generation ──────────────────────────────────────────────────
    TASK_HISTORY_DAYS: int = 90
    TASK_MAX_PER_REP: int = 15
    TASK_MIN_PRIORITY: int = 20
    TASK_GENERATION_BATCH_SIZE: int = 50

    # ── Stockout Prediction ──────────────────────────────────────────────
    STOCKOUT_THRESHOLD: float = 0.7  # probability threshold for alerts
    STOCKOUT_SCAN_BATCH_SIZE: int = 100

    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_url_sync(self) -> str:
        """Synchronous database URL (for Alembic migrations, etc.)."""
        return self.DATABASE_URL.replace("+asyncpg", "")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
