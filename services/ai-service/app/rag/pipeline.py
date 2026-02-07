"""
End-to-end RAG pipeline.

Assembles context from the Qdrant retriever, constructs a prompt using
Jinja2 templates, calls the LLM (Ollama local or Claude cloud fallback),
and parses the structured JSON output via Pydantic.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, TypeVar

import httpx
from jinja2 import Template
from pydantic import BaseModel, ValidationError

from app.core.config import Settings, get_settings
from app.rag.retriever import QdrantRetriever, RetrievedDocument

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class RAGPipeline:
    """Retrieval-Augmented Generation pipeline with LLM fallback chain."""

    def __init__(
        self,
        retriever: QdrantRetriever | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._retriever = retriever
        self._settings = settings or get_settings()

    # ── Public API ────────────────────────────────────────────────────

    async def query(
        self,
        query_text: str,
        collection: str,
        filters: dict[str, Any] | None = None,
        prompt_template: Template | None = None,
        template_vars: dict[str, Any] | None = None,
        output_schema: type[T] | None = None,
        top_k: int = 5,
    ) -> dict[str, Any]:
        """Execute a full RAG query.

        1. Retrieve relevant documents from Qdrant.
        2. Build the prompt with context + template variables.
        3. Call the LLM (with fallback chain).
        4. Parse the output (optionally validate against a Pydantic schema).

        Args:
            query_text: The user's query.
            collection: Qdrant collection to search.
            filters: Metadata filters (e.g. company_id).
            prompt_template: Jinja2 Template to format the prompt.
            template_vars: Additional variables for the template.
            output_schema: Optional Pydantic model for output validation.
            top_k: Number of documents to retrieve.

        Returns:
            A dict with ``result`` (parsed JSON), ``raw_response``,
            ``sources`` (retrieved docs), and ``model_used``.
        """
        # Step 1: Retrieve context
        retrieved_docs: list[RetrievedDocument] = []
        if self._retriever is not None:
            try:
                retrieved_docs = self._retriever.search(
                    collection=collection,
                    query_text=query_text,
                    filters=filters,
                    top_k=top_k,
                )
            except Exception:
                logger.warning("Retrieval failed — proceeding without context.")

        # Step 2: Build prompt
        rag_context = self._format_context(retrieved_docs)
        all_vars = {
            "query": query_text,
            "rag_context": rag_context,
            **(template_vars or {}),
        }

        if prompt_template is not None:
            prompt = prompt_template.render(**all_vars)
        else:
            prompt = self._default_prompt(query_text, rag_context)

        # Step 3: Call LLM with fallback chain
        raw_response, model_used = await self._call_llm_with_fallback(prompt)

        # Step 4: Parse output
        parsed = self._parse_json_response(raw_response)

        # Step 5: Validate with Pydantic schema if provided
        if output_schema is not None and parsed is not None:
            try:
                validated = output_schema.model_validate(parsed)
                parsed = validated.model_dump()
            except ValidationError as exc:
                logger.warning("Output validation failed: %s", exc)
                # Return raw parsed without validation

        return {
            "result": parsed,
            "raw_response": raw_response,
            "sources": [doc.model_dump() for doc in retrieved_docs],
            "model_used": model_used,
        }

    async def generate(
        self,
        prompt: str,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        """Generate a raw LLM response without RAG context.

        Uses the fallback chain: default model -> fast model -> cloud.
        """
        response, _ = await self._call_llm_with_fallback(
            prompt,
            preferred_model=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response

    # ── LLM Call Chain ────────────────────────────────────────────────

    async def _call_llm_with_fallback(
        self,
        prompt: str,
        preferred_model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[str, str]:
        """Try LLMs in order: preferred/default -> fast -> Claude -> error.

        Returns:
            Tuple of (response_text, model_name).
        """
        temp = temperature if temperature is not None else self._settings.LLM_TEMPERATURE
        tokens = max_tokens if max_tokens is not None else self._settings.LLM_MAX_TOKENS

        # Attempt 1: Default (or preferred) Ollama model
        model_1 = preferred_model or self._settings.DEFAULT_MODEL
        try:
            response = await self._call_ollama(prompt, model_1, temp, tokens)
            return response, model_1
        except Exception:
            logger.warning("Default model '%s' failed, trying fast model.", model_1)

        # Attempt 2: Fast Ollama model
        try:
            response = await self._call_ollama(
                prompt, self._settings.FAST_MODEL, temp, tokens
            )
            return response, self._settings.FAST_MODEL
        except Exception:
            logger.warning("Fast model '%s' failed, trying cloud fallback.", self._settings.FAST_MODEL)

        # Attempt 3: Claude API (if key configured)
        if self._settings.ANTHROPIC_API_KEY:
            try:
                response = await self._call_anthropic(prompt, temp, tokens)
                return response, self._settings.ANTHROPIC_MODEL
            except Exception:
                logger.warning("Claude API failed.")

        # Attempt 4: OpenAI API (if key configured)
        if self._settings.OPENAI_API_KEY:
            try:
                response = await self._call_openai(prompt, temp, tokens)
                return response, self._settings.OPENAI_MODEL
            except Exception:
                logger.warning("OpenAI API failed.")

        raise RuntimeError("All LLM providers failed. Cannot generate response.")

    async def _call_ollama(
        self,
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        """Call the Ollama API for local LLM inference."""
        url = f"{self._settings.OLLAMA_BASE_URL}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        async with httpx.AsyncClient(timeout=self._settings.LLM_REQUEST_TIMEOUT) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")

    async def _call_anthropic(
        self,
        prompt: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        """Call the Anthropic Claude API as a cloud fallback."""
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self._settings.ANTHROPIC_API_KEY or "",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": self._settings.ANTHROPIC_MODEL,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }

        async with httpx.AsyncClient(timeout=self._settings.LLM_REQUEST_TIMEOUT) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            content_blocks = data.get("content", [])
            return content_blocks[0].get("text", "") if content_blocks else ""

    async def _call_openai(
        self,
        prompt: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        """Call the OpenAI API as a cloud fallback."""
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self._settings.OPENAI_MODEL,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }

        async with httpx.AsyncClient(timeout=self._settings.LLM_REQUEST_TIMEOUT) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            choices = data.get("choices", [])
            return choices[0]["message"]["content"] if choices else ""

    # ── Helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _format_context(docs: list[RetrievedDocument]) -> str:
        """Format retrieved documents into a text block for the prompt."""
        if not docs:
            return "No relevant context found."

        sections: list[str] = []
        for i, doc in enumerate(docs, 1):
            meta_str = ", ".join(f"{k}={v}" for k, v in doc.metadata.items())
            sections.append(
                f"[Source {i}] (score={doc.score:.3f}, {meta_str})\n{doc.content}"
            )
        return "\n\n".join(sections)

    @staticmethod
    def _default_prompt(query: str, context: str) -> str:
        """Simple default prompt when no template is provided."""
        return (
            f"Answer the following question using the provided context.\n\n"
            f"## Context\n{context}\n\n"
            f"## Question\n{query}\n\n"
            f"## Instructions\nProvide a clear, concise answer in JSON format."
        )

    @staticmethod
    def _parse_json_response(raw: str) -> Any:
        """Extract and parse JSON from an LLM response.

        Handles responses that include markdown code fences or extra text
        around the JSON payload.
        """
        if not raw:
            return None

        # Try direct parse first
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        # Try extracting from markdown code fences
        json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if json_match:
            try:
                return json.loads(json_match.group(1).strip())
            except json.JSONDecodeError:
                pass

        # Try finding a JSON array or object
        for pattern in [
            r"(\[[\s\S]*\])",  # JSON array
            r"(\{[\s\S]*\})",  # JSON object
        ]:
            match = re.search(pattern, raw)
            if match:
                try:
                    return json.loads(match.group(1))
                except json.JSONDecodeError:
                    continue

        logger.warning("Failed to parse JSON from LLM response (length=%d).", len(raw))
        return {"raw_text": raw}
