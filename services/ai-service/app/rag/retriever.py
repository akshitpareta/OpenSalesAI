"""
Qdrant vector store retriever.

Wraps the Qdrant client to provide semantic search over the three core
collections: store_profiles, product_catalog, and sales_playbooks.
Supports metadata filtering scoped to company_id / territory_id.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from pydantic import BaseModel, Field
from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    ScoredPoint,
    VectorParams,
)

from app.rag.embeddings import EmbeddingService

logger = logging.getLogger(__name__)


class RetrievedDocument(BaseModel):
    """A single retrieved document with metadata and relevance score."""

    id: str
    score: float
    content: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class QdrantRetriever:
    """Semantic search over Qdrant vector collections."""

    def __init__(
        self,
        client: QdrantClient,
        embedding_service: EmbeddingService,
    ) -> None:
        self._client = client
        self._embeddings = embedding_service

    # ── Collection Management ─────────────────────────────────────────

    def ensure_collection(
        self,
        collection_name: str,
        dimension: int | None = None,
    ) -> None:
        """Create a collection if it does not already exist."""
        dim = dimension or self._embeddings.dimension

        existing = [c.name for c in self._client.get_collections().collections]
        if collection_name in existing:
            logger.debug("Collection '%s' already exists.", collection_name)
            return

        self._client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
        )
        logger.info("Created Qdrant collection '%s' (dim=%d).", collection_name, dim)

    # ── Search ────────────────────────────────────────────────────────

    def search(
        self,
        collection: str,
        query_text: str,
        filters: dict[str, Any] | None = None,
        top_k: int = 5,
    ) -> list[RetrievedDocument]:
        """Search a collection using a text query.

        Args:
            collection: Name of the Qdrant collection.
            query_text: Natural-language query text.
            filters: Optional metadata filters (e.g. ``{"company_id": "..."}``).
            top_k: Number of results to return.

        Returns:
            Ranked list of ``RetrievedDocument`` instances.
        """
        query_vector = self._embeddings.generate_embedding(query_text)
        return self.search_by_vector(collection, query_vector, filters, top_k)

    def search_by_vector(
        self,
        collection: str,
        vector: list[float],
        filters: dict[str, Any] | None = None,
        top_k: int = 5,
    ) -> list[RetrievedDocument]:
        """Search a collection using a pre-computed vector.

        Args:
            collection: Name of the Qdrant collection.
            vector: Pre-computed embedding vector.
            filters: Optional metadata key-value filters.
            top_k: Number of results to return.

        Returns:
            Ranked list of ``RetrievedDocument`` instances.
        """
        qdrant_filter = self._build_filter(filters) if filters else None

        try:
            scored_points: list[ScoredPoint] = self._client.search(
                collection_name=collection,
                query_vector=vector,
                query_filter=qdrant_filter,
                limit=top_k,
                with_payload=True,
            )
        except Exception:
            logger.exception("Qdrant search failed on collection '%s'.", collection)
            return []

        results: list[RetrievedDocument] = []
        for point in scored_points:
            payload = point.payload or {}
            results.append(
                RetrievedDocument(
                    id=str(point.id),
                    score=point.score,
                    content=payload.get("content", payload.get("text", "")),
                    metadata={k: v for k, v in payload.items() if k not in ("content", "text")},
                )
            )

        return results

    # ── Upsert ────────────────────────────────────────────────────────

    def upsert_documents(
        self,
        collection: str,
        documents: list[dict[str, Any]],
        content_field: str = "content",
        batch_size: int = 100,
    ) -> int:
        """Embed and upsert documents into a Qdrant collection.

        Each document dict must contain at least a ``content`` (or ``text``)
        field. All other fields are stored as payload metadata. If an ``id``
        field is present it is used as the point id; otherwise a UUID is
        generated.

        Args:
            collection: Target Qdrant collection.
            documents: List of document dicts.
            content_field: Key in each dict that holds the text to embed.
            batch_size: Number of documents to upsert per batch.

        Returns:
            Total number of documents upserted.
        """
        if not documents:
            return 0

        self.ensure_collection(collection)

        total = 0
        for start in range(0, len(documents), batch_size):
            batch = documents[start : start + batch_size]
            texts = [doc.get(content_field, doc.get("text", "")) for doc in batch]
            vectors = self._embeddings.batch_generate_embeddings(texts)

            points: list[PointStruct] = []
            for doc, vec in zip(batch, vectors, strict=True):
                point_id = doc.get("id", str(uuid.uuid4()))
                payload = {k: v for k, v in doc.items() if k != "id"}
                points.append(PointStruct(id=point_id, vector=vec, payload=payload))

            self._client.upsert(collection_name=collection, points=points, wait=True)
            total += len(points)
            logger.debug(
                "Upserted %d documents into '%s' (%d/%d).",
                len(points),
                collection,
                total,
                len(documents),
            )

        logger.info("Upserted %d documents into collection '%s'.", total, collection)
        return total

    # ── Delete ────────────────────────────────────────────────────────

    def delete_by_filter(
        self,
        collection: str,
        filters: dict[str, Any],
    ) -> None:
        """Delete points matching the given metadata filters."""
        qdrant_filter = self._build_filter(filters)
        self._client.delete(
            collection_name=collection,
            points_selector=qdrant_filter,
        )
        logger.info("Deleted points from '%s' matching %s.", collection, filters)

    # ── Internals ─────────────────────────────────────────────────────

    @staticmethod
    def _build_filter(filters: dict[str, Any]) -> Filter:
        """Convert a flat key-value dict into a Qdrant ``Filter``."""
        conditions: list[FieldCondition] = []
        for key, value in filters.items():
            conditions.append(
                FieldCondition(key=key, match=MatchValue(value=value))
            )
        return Filter(must=conditions)
