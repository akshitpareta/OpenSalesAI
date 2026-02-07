"""
RAG query and order parsing API endpoints.

POST /rag/query     — direct RAG query against any collection.
POST /orders/parse  — parse natural-language order text into structured items.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.security import CurrentUser

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request / Response Models ────────────────────────────────────────────────


class RAGQueryRequest(BaseModel):
    """Request body for a RAG query."""

    query: str
    collection: str = "store_profiles"
    filters: dict[str, Any] = Field(default_factory=dict)
    top_k: int = 5
    company_id: str = ""


class RAGSource(BaseModel):
    """A single retrieved source document."""

    id: str
    score: float
    content: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class RAGQueryResponse(BaseModel):
    """Response from a RAG query."""

    result: Any = None
    raw_response: str = ""
    sources: list[RAGSource] = Field(default_factory=list)
    model_used: str = ""


class OrderParseRequest(BaseModel):
    """Request body for order parsing."""

    text: str
    store_id: str = ""
    language: str = "auto"
    company_id: str = ""


class ParsedOrderItem(BaseModel):
    """A single parsed order line item."""

    product_name_raw: str = ""
    product_name_matched: str = ""
    product_id: str | None = None
    sku_code: str | None = None
    quantity: int = 0
    unit: str = "pieces"
    confidence: float = 0.0


class OrderParseResponse(BaseModel):
    """Response from order parsing."""

    items: list[ParsedOrderItem] = Field(default_factory=list)
    notes: str = ""
    language_detected: str = ""
    model_used: str = ""
    sources: list[RAGSource] = Field(default_factory=list)


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/query", response_model=RAGQueryResponse)
async def rag_query(
    body: RAGQueryRequest,
    request: Request,
    user: CurrentUser,
) -> RAGQueryResponse:
    """Execute a direct RAG query against any Qdrant collection.

    Retrieves relevant documents, constructs a prompt with context,
    calls the LLM, and returns the structured result along with sources.
    """
    settings = get_settings()

    # Build RAG pipeline
    from app.rag.pipeline import RAGPipeline
    from app.rag.retriever import QdrantRetriever

    retriever = None
    qdrant = getattr(request.app.state, "qdrant", None)
    embedding_service = getattr(request.app.state, "embedding_service", None)

    if qdrant is not None and embedding_service is not None:
        retriever = QdrantRetriever(client=qdrant, embedding_service=embedding_service)
    else:
        logger.warning("RAG infrastructure not available (Qdrant or embedding service missing).")

    rag_pipeline = RAGPipeline(retriever=retriever, settings=settings)

    # Build filters with company_id
    filters = dict(body.filters)
    company_id = body.company_id or user.company_id
    if company_id:
        filters["company_id"] = company_id

    try:
        result = await rag_pipeline.query(
            query_text=body.query,
            collection=body.collection,
            filters=filters if filters else None,
            top_k=body.top_k,
        )
    except Exception:
        logger.exception("RAG query failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="RAG query failed. Please try again.",
        )

    sources = [
        RAGSource(
            id=s.get("id", ""),
            score=s.get("score", 0),
            content=s.get("content", ""),
            metadata=s.get("metadata", {}),
        )
        for s in result.get("sources", [])
    ]

    return RAGQueryResponse(
        result=result.get("result"),
        raw_response=result.get("raw_response", ""),
        sources=sources,
        model_used=result.get("model_used", ""),
    )


@router.post("/parse", response_model=OrderParseResponse)
async def parse_order(
    body: OrderParseRequest,
    request: Request,
    user: CurrentUser,
) -> OrderParseResponse:
    """Parse natural-language order text into structured line items.

    Handles Hindi, English, and Hinglish mixed-language input.
    Supports colloquial product names, abbreviations, and unit conversions.

    This endpoint is called by the WhatsApp webhook handler and the
    order agent.
    """
    if not body.text or not body.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order text cannot be empty.",
        )

    settings = get_settings()

    from app.rag.pipeline import RAGPipeline
    from app.rag.prompts import ORDER_PARSER_PROMPT
    from app.rag.retriever import QdrantRetriever

    retriever = None
    qdrant = getattr(request.app.state, "qdrant", None)
    embedding_service = getattr(request.app.state, "embedding_service", None)

    if qdrant is not None and embedding_service is not None:
        retriever = QdrantRetriever(client=qdrant, embedding_service=embedding_service)

    rag_pipeline = RAGPipeline(retriever=retriever, settings=settings)

    company_id = body.company_id or user.company_id

    # Build template variables
    template_vars = {
        "store_id": body.store_id,
        "store_name": "",
        "usual_products": "Not available",
        "language": body.language,
        "order_text": body.text,
    }

    try:
        result = await rag_pipeline.query(
            query_text=body.text,
            collection=settings.QDRANT_COLLECTION_PRODUCT_CATALOG,
            filters={"company_id": company_id} if company_id else None,
            prompt_template=ORDER_PARSER_PROMPT,
            template_vars=template_vars,
            top_k=10,
        )
    except Exception:
        logger.exception("Order parsing failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Order parsing failed. Please try again.",
        )

    parsed = result.get("result", {})

    if isinstance(parsed, dict):
        raw_items = parsed.get("items", [])
        notes = parsed.get("notes", "")
        language_detected = parsed.get("language_detected", "")
    elif isinstance(parsed, list):
        raw_items = parsed
        notes = ""
        language_detected = ""
    else:
        raw_items = []
        notes = ""
        language_detected = ""

    items = [
        ParsedOrderItem(
            product_name_raw=item.get("product_name_raw", ""),
            product_name_matched=item.get("product_name_matched", ""),
            product_id=item.get("product_id"),
            sku_code=item.get("sku_code"),
            quantity=int(item.get("quantity", 0)),
            unit=item.get("unit", "pieces"),
            confidence=float(item.get("confidence", 0)),
        )
        for item in raw_items
    ]

    sources = [
        RAGSource(
            id=s.get("id", ""),
            score=s.get("score", 0),
            content=s.get("content", ""),
            metadata=s.get("metadata", {}),
        )
        for s in result.get("sources", [])
    ]

    return OrderParseResponse(
        items=items,
        notes=notes,
        language_detected=language_detected,
        model_used=result.get("model_used", ""),
        sources=sources,
    )
