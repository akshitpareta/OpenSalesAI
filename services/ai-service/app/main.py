"""
OpenSalesAI — AI Service entry point.

FastAPI application with lifespan management for database, Qdrant, and
embedding model initialisation. All API routers are included here.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.core.config import get_settings
from app.core.database import close_db, init_db

logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown lifecycle hook."""
    settings = get_settings()

    # ── Startup ───────────────────────────────────────────────────────
    logger.info("Starting %s v%s [%s]", settings.APP_NAME, settings.APP_VERSION, settings.ENVIRONMENT)

    # 1. Database
    await init_db(settings)

    # 2. Qdrant client (lazy — stored on app.state)
    try:
        from qdrant_client import QdrantClient

        qdrant = QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY,
            timeout=30,
        )
        app.state.qdrant = qdrant
        logger.info("Qdrant client connected to %s", settings.QDRANT_URL)
    except Exception:
        logger.warning("Qdrant not available — vector search will be disabled.")
        app.state.qdrant = None

    # 3. Embedding model (lazy singleton)
    try:
        from app.rag.embeddings import EmbeddingService

        embedding_service = EmbeddingService(
            model_name=settings.EMBEDDING_MODEL,
            device=settings.EMBEDDING_DEVICE,
        )
        app.state.embedding_service = embedding_service
        logger.info("Embedding model '%s' loaded on %s", settings.EMBEDDING_MODEL, settings.EMBEDDING_DEVICE)
    except Exception:
        logger.warning("Embedding model not available — RAG will be disabled.")
        app.state.embedding_service = None

    # 4. Redis client
    try:
        import redis.asyncio as aioredis

        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
        await redis_client.ping()
        app.state.redis = redis_client
        logger.info("Redis connected to %s", settings.REDIS_URL)
    except Exception:
        logger.warning("Redis not available — caching will be disabled.")
        app.state.redis = None

    yield

    # ── Shutdown ──────────────────────────────────────────────────────
    logger.info("Shutting down %s", settings.APP_NAME)
    await close_db()

    if app.state.qdrant is not None:
        try:
            app.state.qdrant.close()
        except Exception:
            pass

    if getattr(app.state, "redis", None) is not None:
        try:
            await app.state.redis.close()
        except Exception:
            pass


# ── App Factory ──────────────────────────────────────────────────────────────


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "AI/ML core engine for OpenSalesAI — task generation, demand "
            "forecasting, LangGraph agents, and RAG pipelines."
        ),
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Logging ───────────────────────────────────────────────────────
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    # ── Routers ───────────────────────────────────────────────────────
    from app.api.tasks import router as tasks_router
    from app.api.predictions import router as predictions_router
    from app.api.agents import router as agents_router
    from app.api.rag import router as rag_router

    app.include_router(tasks_router, prefix="/tasks", tags=["Tasks"])
    app.include_router(predictions_router, prefix="/predictions", tags=["Predictions"])
    app.include_router(agents_router, prefix="/agent", tags=["Agents"])
    app.include_router(rag_router, prefix="/rag", tags=["RAG"])
    # Order parsing lives under /orders but is in the rag module
    app.include_router(rag_router, prefix="/orders", tags=["Orders"], include_in_schema=False)

    # ── Health ────────────────────────────────────────────────────────
    @app.get("/health", tags=["Health"])
    async def health_check() -> dict:
        return {
            "status": "healthy",
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
        }

    @app.get("/ready", tags=["Health"])
    async def readiness_check() -> dict:
        checks: dict[str, str] = {}
        # DB
        try:
            from app.core.database import get_engine
            from sqlalchemy import text

            async with get_engine().connect() as conn:
                await conn.execute(text("SELECT 1"))
            checks["database"] = "ok"
        except Exception:
            checks["database"] = "unavailable"

        # Qdrant
        if app.state.qdrant is not None:
            try:
                app.state.qdrant.get_collections()
                checks["qdrant"] = "ok"
            except Exception:
                checks["qdrant"] = "unavailable"
        else:
            checks["qdrant"] = "not_configured"

        # Redis
        if getattr(app.state, "redis", None) is not None:
            try:
                await app.state.redis.ping()
                checks["redis"] = "ok"
            except Exception:
                checks["redis"] = "unavailable"
        else:
            checks["redis"] = "not_configured"

        all_ok = all(v == "ok" for v in checks.values() if v != "not_configured")
        return {"status": "ready" if all_ok else "degraded", "checks": checks}

    return app


# Module-level app instance for uvicorn
app = create_app()
