"""
Text-to-speech service using Piper TTS.

Generates natural-sounding speech in Hindi and English for automated
voice calls (payment collection, coaching, order confirmation).
Falls back to gTTS if Piper models are not available.
"""

from __future__ import annotations

import io
import logging
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class TTSResult(BaseModel):
    """Result of a text-to-speech synthesis."""

    audio_bytes: bytes
    format: str = "wav"
    sample_rate: int = 22050
    duration_seconds: float = 0.0
    language: str = "hi"
    voice: str = "default"


# Map of language codes to Piper model names
PIPER_VOICE_MAP: dict[str, str] = {
    "hi_male": "hi_CV-male",
    "hi_female": "hi_CV-female",
    "en_male": "en_US-lessac-medium",
    "en_female": "en_US-amy-medium",
    "default": "hi_CV-male",
}


class TTSService:
    """Text-to-speech synthesis using Piper TTS with gTTS fallback."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._model_dir = Path(self._settings.PIPER_MODEL_DIR)
        self._piper_available: bool | None = None

    def _check_piper_available(self) -> bool:
        """Check if the piper CLI binary is available."""
        if self._piper_available is not None:
            return self._piper_available

        try:
            result = subprocess.run(
                ["piper", "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            self._piper_available = result.returncode == 0
            if self._piper_available:
                logger.info("Piper TTS binary found.")
            return self._piper_available
        except (FileNotFoundError, subprocess.TimeoutExpired):
            self._piper_available = False
            logger.info("Piper TTS not found — will use gTTS fallback.")
            return False

    async def synthesize(
        self,
        text: str,
        language: str = "hi",
        voice: str = "default",
        speed: float = 1.0,
    ) -> bytes:
        """Synthesize speech from text.

        Args:
            text: Input text to speak.
            language: Language code ("hi", "en").
            voice: Voice variant ("default", "male", "female").
            speed: Speaking speed multiplier (0.5-2.0).

        Returns:
            WAV audio bytes.
        """
        if not text or not text.strip():
            return b""

        # Try Piper first
        if self._check_piper_available():
            try:
                return await self._synthesize_piper(text, language, voice, speed)
            except Exception:
                logger.warning("Piper synthesis failed, falling back to gTTS.")

        # Fallback to gTTS
        return await self._synthesize_gtts(text, language)

    async def _synthesize_piper(
        self,
        text: str,
        language: str,
        voice: str,
        speed: float,
    ) -> bytes:
        """Synthesize using the Piper TTS engine."""
        # Resolve voice model
        voice_key = f"{language}_{voice}" if voice != "default" else "default"
        model_name = PIPER_VOICE_MAP.get(voice_key, PIPER_VOICE_MAP["default"])
        model_path = self._model_dir / f"{model_name}.onnx"

        if not model_path.exists():
            raise FileNotFoundError(f"Piper model not found: {model_path}")

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            output_path = Path(tmp.name)

        try:
            # Piper reads from stdin and writes WAV to output file
            cmd = [
                "piper",
                "--model", str(model_path),
                "--output_file", str(output_path),
                "--length_scale", str(1.0 / max(0.5, min(2.0, speed))),
            ]

            process = subprocess.run(
                cmd,
                input=text,
                capture_output=True,
                text=True,
                timeout=30,
            )

            if process.returncode != 0:
                raise RuntimeError(f"Piper failed: {process.stderr}")

            audio_bytes = output_path.read_bytes()
            logger.debug(
                "Piper synthesized %d bytes for '%s' (voice=%s).",
                len(audio_bytes),
                text[:50],
                model_name,
            )
            return audio_bytes

        finally:
            try:
                output_path.unlink(missing_ok=True)
            except Exception:
                pass

    async def _synthesize_gtts(
        self,
        text: str,
        language: str,
    ) -> bytes:
        """Fallback TTS using Google's gTTS (requires internet)."""
        try:
            from gtts import gTTS
        except ImportError:
            logger.error("gTTS not installed. Cannot synthesize speech.")
            raise RuntimeError("No TTS engine available (Piper not found, gTTS not installed).")

        # gTTS language mapping
        gtts_lang = language if language in ("hi", "en", "bn", "ta", "te", "mr", "gu") else "hi"

        tts = gTTS(text=text, lang=gtts_lang, slow=False)
        mp3_buffer = io.BytesIO()
        tts.write_to_fp(mp3_buffer)
        mp3_bytes = mp3_buffer.getvalue()

        # Convert MP3 to WAV for consistency
        wav_bytes = self._mp3_to_wav(mp3_bytes)

        logger.debug(
            "gTTS synthesized %d bytes for '%s' (lang=%s).",
            len(wav_bytes),
            text[:50],
            gtts_lang,
        )
        return wav_bytes

    @staticmethod
    def _mp3_to_wav(mp3_bytes: bytes) -> bytes:
        """Convert MP3 bytes to WAV using pydub (or return as-is if unavailable)."""
        try:
            from pydub import AudioSegment

            mp3_io = io.BytesIO(mp3_bytes)
            audio = AudioSegment.from_mp3(mp3_io)
            wav_io = io.BytesIO()
            audio.export(wav_io, format="wav")
            return wav_io.getvalue()
        except ImportError:
            # If pydub is not available, return raw MP3
            logger.warning("pydub not available — returning MP3 instead of WAV.")
            return mp3_bytes
        except Exception:
            logger.warning("MP3->WAV conversion failed — returning raw MP3.")
            return mp3_bytes

    def get_available_voices(self) -> dict[str, list[str]]:
        """Return available voices grouped by language."""
        result: dict[str, list[str]] = {}
        for key, model in PIPER_VOICE_MAP.items():
            if key == "default":
                continue
            parts = key.split("_", 1)
            lang = parts[0]
            variant = parts[1] if len(parts) > 1 else "default"
            result.setdefault(lang, []).append(variant)
        return result
