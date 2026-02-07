"""
Speech-to-text service using faster-whisper (CTranslate2 backend).

Provides GPU-accelerated transcription with support for Hindi, English,
and mixed-language audio. Optimised for short voice messages from
WhatsApp (typically 5-60 seconds).
"""

from __future__ import annotations

import io
import logging
import tempfile
import time
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class TranscriptionSegment(BaseModel):
    """A single transcription segment with timing information."""

    start: float
    end: float
    text: str
    confidence: float = 0.0


class TranscriptionResult(BaseModel):
    """Complete transcription result."""

    text: str
    language: str
    language_probability: float = 0.0
    duration_seconds: float = 0.0
    segments: list[TranscriptionSegment] = Field(default_factory=list)
    processing_time_seconds: float = 0.0


class WhisperService:
    """GPU-accelerated speech-to-text using faster-whisper."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._model = None
        self._model_loaded = False

    def _ensure_model(self) -> Any:
        """Lazy-load the Whisper model on first use."""
        if self._model is not None:
            return self._model

        try:
            from faster_whisper import WhisperModel

            logger.info(
                "Loading Whisper model '%s' on device '%s' (compute=%s)...",
                self._settings.WHISPER_MODEL_SIZE,
                self._settings.WHISPER_DEVICE,
                self._settings.WHISPER_COMPUTE_TYPE,
            )

            self._model = WhisperModel(
                self._settings.WHISPER_MODEL_SIZE,
                device=self._settings.WHISPER_DEVICE,
                compute_type=self._settings.WHISPER_COMPUTE_TYPE,
            )
            self._model_loaded = True
            logger.info("Whisper model loaded successfully.")
            return self._model
        except Exception:
            logger.exception("Failed to load Whisper model.")
            raise

    async def transcribe(
        self,
        audio_bytes: bytes,
        language: str | None = None,
        task: str = "transcribe",
    ) -> TranscriptionResult:
        """Transcribe audio bytes to text.

        Args:
            audio_bytes: Raw audio data (supports wav, mp3, ogg, m4a, webm).
            language: ISO language code (e.g., "hi", "en"). If None, auto-detect.
            task: "transcribe" for same-language or "translate" for English translation.

        Returns:
            ``TranscriptionResult`` with full text, segments, and metadata.
        """
        start_time = time.monotonic()
        model = self._ensure_model()

        # Write audio bytes to a temp file (faster-whisper needs a file path)
        suffix = ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = Path(tmp.name)

        try:
            lang = language or self._settings.WHISPER_DEFAULT_LANGUAGE

            segments_iter, info = model.transcribe(
                str(tmp_path),
                language=lang,
                task=task,
                beam_size=5,
                best_of=5,
                patience=1.5,
                length_penalty=1.0,
                temperature=[0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
                compression_ratio_threshold=2.4,
                log_prob_threshold=-1.0,
                no_speech_threshold=0.6,
                vad_filter=True,
                vad_parameters={
                    "min_silence_duration_ms": 500,
                    "speech_pad_ms": 400,
                },
            )

            # Collect segments
            segments: list[TranscriptionSegment] = []
            full_text_parts: list[str] = []

            for seg in segments_iter:
                segments.append(
                    TranscriptionSegment(
                        start=seg.start,
                        end=seg.end,
                        text=seg.text.strip(),
                        confidence=seg.avg_logprob,
                    )
                )
                full_text_parts.append(seg.text.strip())

            full_text = " ".join(full_text_parts)
            processing_time = time.monotonic() - start_time

            result = TranscriptionResult(
                text=full_text,
                language=info.language,
                language_probability=info.language_probability,
                duration_seconds=info.duration,
                segments=segments,
                processing_time_seconds=round(processing_time, 3),
            )

            logger.info(
                "Transcribed %.1fs audio in %.2fs (lang=%s, prob=%.2f): '%s'",
                info.duration,
                processing_time,
                info.language,
                info.language_probability,
                full_text[:100],
            )

            return result

        finally:
            # Clean up temp file
            try:
                tmp_path.unlink(missing_ok=True)
            except Exception:
                pass

    async def transcribe_from_url(
        self,
        audio_url: str,
        language: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> TranscriptionResult:
        """Download audio from a URL and transcribe it.

        Useful for WhatsApp media URLs that require authentication headers.
        """
        import httpx

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(audio_url, headers=headers or {})
            resp.raise_for_status()
            audio_bytes = resp.content

        return await self.transcribe(audio_bytes, language=language)

    @property
    def is_loaded(self) -> bool:
        """Check if the Whisper model is loaded."""
        return self._model_loaded

    def get_supported_languages(self) -> list[str]:
        """Return a list of commonly supported Indian + global languages."""
        return [
            "hi",    # Hindi
            "en",    # English
            "bn",    # Bengali
            "te",    # Telugu
            "mr",    # Marathi
            "ta",    # Tamil
            "gu",    # Gujarati
            "kn",    # Kannada
            "ml",    # Malayalam
            "pa",    # Punjabi
            "ur",    # Urdu
            "or",    # Odia
            "as",    # Assamese
        ]
