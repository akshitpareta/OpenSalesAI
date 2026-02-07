"""
Embedding generation service using sentence-transformers.

Uses the ``all-MiniLM-L6-v2`` model (384 dimensions) by default. The model
is loaded once and reused for all requests. GPU acceleration is used when
available.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import numpy as np
from sentence_transformers import SentenceTransformer

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Generate dense vector embeddings for text using sentence-transformers."""

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        device: str = "cuda",
        batch_size: int = 64,
    ) -> None:
        self._model_name = model_name
        self._batch_size = batch_size
        self._device = device

        logger.info("Loading embedding model '%s' on device '%s'...", model_name, device)
        self._model = SentenceTransformer(model_name, device=device)
        self._dimension = self._model.get_sentence_embedding_dimension()
        logger.info(
            "Embedding model loaded — dimension=%d, device=%s",
            self._dimension,
            device,
        )

    @property
    def dimension(self) -> int:
        """Return the embedding vector dimension."""
        return self._dimension  # type: ignore[return-value]

    @property
    def model_name(self) -> str:
        return self._model_name

    def generate_embedding(self, text: str) -> list[float]:
        """Generate a single embedding vector for the given text.

        Args:
            text: Input text string.

        Returns:
            A list of floats representing the embedding vector.
        """
        if not text or not text.strip():
            return [0.0] * self._dimension

        embedding: np.ndarray = self._model.encode(
            text,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return embedding.tolist()

    def batch_generate_embeddings(
        self,
        texts: list[str],
        batch_size: int | None = None,
    ) -> list[list[float]]:
        """Generate embeddings for a batch of texts.

        Args:
            texts: List of input text strings.
            batch_size: Override the default batch size.

        Returns:
            A list of embedding vectors (each is a list of floats).
        """
        if not texts:
            return []

        effective_batch = batch_size or self._batch_size

        # Replace empty strings with a placeholder to avoid model errors
        cleaned = [t if t and t.strip() else " " for t in texts]

        embeddings: np.ndarray = self._model.encode(
            cleaned,
            batch_size=effective_batch,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=len(cleaned) > 100,
        )

        result: list[list[float]] = []
        for i, original_text in enumerate(texts):
            if not original_text or not original_text.strip():
                result.append([0.0] * self._dimension)
            else:
                result.append(embeddings[i].tolist())

        return result

    def similarity(self, text_a: str, text_b: str) -> float:
        """Compute cosine similarity between two texts.

        Returns a float in [-1, 1] (typically [0, 1] for normalised embeddings).
        """
        vec_a = np.array(self.generate_embedding(text_a))
        vec_b = np.array(self.generate_embedding(text_b))

        dot = np.dot(vec_a, vec_b)
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return float(dot / (norm_a * norm_b))
