"""
Conversational agent API endpoint.

POST /agent/chat — main chat endpoint for the LangGraph multi-agent system.
POST /agent/stt  — speech-to-text transcription.
POST /agent/tts  — text-to-speech synthesis.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, status
from pydantic import BaseModel, Field

from app.agents.state import ChatRequest, ChatResponse
from app.core.config import get_settings
from app.core.security import CurrentUser

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request / Response Models ────────────────────────────────────────────────


class ChatRequestBody(BaseModel):
    """API request body for chat."""

    session_id: str
    user_type: str = "rep"
    user_id: str
    company_id: str = ""
    message: str
    language: str = "en"
    context: dict[str, Any] = Field(default_factory=dict)


class ChatResponseBody(BaseModel):
    """API response body for chat."""

    session_id: str
    response: str
    intent: str = ""
    confidence: float = 0.0
    structured_output: dict[str, Any] = Field(default_factory=dict)
    agent_used: str = ""
    escalated: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


class STTResponse(BaseModel):
    """Speech-to-text response."""

    text: str
    language: str
    language_probability: float = 0.0
    duration_seconds: float = 0.0
    processing_time_seconds: float = 0.0


class TTSRequest(BaseModel):
    """Text-to-speech request."""

    text: str
    language: str = "hi"
    voice: str = "default"
    speed: float = 1.0


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/chat", response_model=ChatResponseBody)
async def chat(
    body: ChatRequestBody,
    request: Request,
    user: CurrentUser,
) -> ChatResponseBody:
    """Conversational endpoint for the multi-agent system.

    Routes messages to the appropriate specialist agent (order, coaching,
    analytics, collection, promotion) based on intent detection.
    """
    settings = get_settings()

    # Build RAG pipeline with app-level services
    from app.rag.pipeline import RAGPipeline
    from app.rag.retriever import QdrantRetriever

    retriever = None
    qdrant = getattr(request.app.state, "qdrant", None)
    embedding_service = getattr(request.app.state, "embedding_service", None)

    if qdrant is not None and embedding_service is not None:
        retriever = QdrantRetriever(client=qdrant, embedding_service=embedding_service)

    rag_pipeline = RAGPipeline(retriever=retriever, settings=settings)

    # Build and run supervisor
    from app.agents.supervisor import SupervisorAgent

    supervisor = SupervisorAgent(rag_pipeline=rag_pipeline)

    chat_request = ChatRequest(
        session_id=body.session_id,
        user_type=body.user_type,
        user_id=body.user_id,
        company_id=body.company_id or user.company_id,
        message=body.message,
        language=body.language,
        context=body.context,
    )

    try:
        result = await supervisor.run(chat_request)
    except Exception:
        logger.exception("Agent chat failed.")
        result = ChatResponse(
            session_id=body.session_id,
            response="I'm sorry, I encountered an error. Please try again.",
            intent="error",
        )

    return ChatResponseBody(
        session_id=result.session_id,
        response=result.response,
        intent=result.intent,
        confidence=result.confidence,
        structured_output=result.structured_output,
        agent_used=result.agent_used,
        escalated=result.escalated,
        metadata=result.metadata,
    )


@router.post("/stt", response_model=STTResponse)
async def speech_to_text(
    audio: UploadFile = File(...),
    language: str = Form(default="hi"),
    user: CurrentUser = Depends(),
) -> STTResponse:
    """Transcribe audio to text using Whisper.

    Accepts audio file uploads (WAV, MP3, OGG, M4A, WEBM).
    Default language is Hindi.
    """
    from app.services.whisper_stt import WhisperService

    # Validate file size (max 25 MB)
    content = await audio.read()
    max_size = 25 * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Audio file too large ({len(content)} bytes). Max: {max_size} bytes.",
        )

    whisper = WhisperService()

    try:
        result = await whisper.transcribe(
            audio_bytes=content,
            language=language if language != "auto" else None,
        )
    except Exception:
        logger.exception("Speech-to-text failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Speech-to-text transcription failed.",
        )

    return STTResponse(
        text=result.text,
        language=result.language,
        language_probability=result.language_probability,
        duration_seconds=result.duration_seconds,
        processing_time_seconds=result.processing_time_seconds,
    )


@router.post("/tts")
async def text_to_speech(
    body: TTSRequest,
    user: CurrentUser,
):
    """Synthesize speech from text using Piper TTS.

    Returns WAV audio bytes.
    """
    from fastapi.responses import Response

    from app.services.tts_service import TTSService

    tts = TTSService()

    try:
        audio_bytes = await tts.synthesize(
            text=body.text,
            language=body.language,
            voice=body.voice,
            speed=body.speed,
        )
    except Exception:
        logger.exception("Text-to-speech failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Text-to-speech synthesis failed.",
        )

    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No audio generated. Input text may be empty.",
        )

    return Response(
        content=audio_bytes,
        media_type="audio/wav",
        headers={"Content-Disposition": "attachment; filename=speech.wav"},
    )
