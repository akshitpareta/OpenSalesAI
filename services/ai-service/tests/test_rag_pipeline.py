"""
Tests for the RAG pipeline.

Verifies:
- Context formatting from retrieved documents
- Prompt assembly with Jinja2 templates
- JSON parsing from various LLM output formats
- LLM fallback chain logic
- Query orchestration (retrieve -> prompt -> LLM -> parse)
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from jinja2 import Template

from app.core.config import Settings
from app.rag.pipeline import RAGPipeline
from app.rag.retriever import QdrantRetriever, RetrievedDocument


# ── JSON Parsing Tests ────────────────────────────────────────────────────────


class TestParseJsonResponse:
    """Test the static _parse_json_response method."""

    def test_parse_valid_json_object(self) -> None:
        raw = '{"action": "Visit store", "priority": 85}'
        result = RAGPipeline._parse_json_response(raw)
        assert result == {"action": "Visit store", "priority": 85}

    def test_parse_valid_json_array(self) -> None:
        raw = '[{"item": "Maggi", "qty": 2}, {"item": "Lays", "qty": 5}]'
        result = RAGPipeline._parse_json_response(raw)
        assert isinstance(result, list)
        assert len(result) == 2

    def test_parse_json_from_markdown_code_fence(self) -> None:
        raw = 'Here is the output:\n```json\n{"key": "value"}\n```\nDone.'
        result = RAGPipeline._parse_json_response(raw)
        assert result == {"key": "value"}

    def test_parse_json_from_code_fence_without_language(self) -> None:
        raw = 'Result:\n```\n[1, 2, 3]\n```'
        result = RAGPipeline._parse_json_response(raw)
        assert result == [1, 2, 3]

    def test_parse_json_embedded_in_text(self) -> None:
        raw = 'The answer is: [{"a": 1}] and that is all.'
        result = RAGPipeline._parse_json_response(raw)
        assert isinstance(result, list)
        assert result[0]["a"] == 1

    def test_returns_none_for_empty_string(self) -> None:
        result = RAGPipeline._parse_json_response("")
        assert result is None

    def test_returns_raw_text_dict_for_unparseable(self) -> None:
        raw = "This is not JSON at all. No brackets anywhere."
        result = RAGPipeline._parse_json_response(raw)
        assert isinstance(result, dict)
        assert "raw_text" in result


# ── Context Formatting Tests ──────────────────────────────────────────────────


class TestFormatContext:
    """Test the static _format_context method."""

    def test_no_docs_returns_placeholder(self) -> None:
        result = RAGPipeline._format_context([])
        assert result == "No relevant context found."

    def test_formats_single_document(self) -> None:
        docs = [
            RetrievedDocument(
                content="Store info here",
                metadata={"city": "Mumbai"},
                score=0.9,
            )
        ]
        result = RAGPipeline._format_context(docs)
        assert "[Source 1]" in result
        assert "score=0.900" in result
        assert "city=Mumbai" in result
        assert "Store info here" in result

    def test_formats_multiple_documents(self) -> None:
        docs = [
            RetrievedDocument(content="Doc 1", metadata={"a": "1"}, score=0.9),
            RetrievedDocument(content="Doc 2", metadata={"b": "2"}, score=0.8),
            RetrievedDocument(content="Doc 3", metadata={"c": "3"}, score=0.7),
        ]
        result = RAGPipeline._format_context(docs)
        assert "[Source 1]" in result
        assert "[Source 2]" in result
        assert "[Source 3]" in result


# ── Default Prompt Tests ──────────────────────────────────────────────────────


class TestDefaultPrompt:
    """Test the default prompt builder."""

    def test_includes_query_and_context(self) -> None:
        prompt = RAGPipeline._default_prompt("What tasks?", "Some context here")
        assert "What tasks?" in prompt
        assert "Some context here" in prompt
        assert "JSON format" in prompt


# ── Query Integration Tests (with mocked LLM) ────────────────────────────────


class TestRAGPipelineQuery:
    """Test the full query method with mocked components."""

    @pytest.mark.asyncio
    async def test_query_returns_parsed_result(
        self, mock_qdrant_retriever: MagicMock, test_settings: Settings
    ) -> None:
        """Full RAG query should return parsed JSON with sources."""
        pipeline = RAGPipeline(
            retriever=mock_qdrant_retriever,
            settings=test_settings,
        )

        # Mock the LLM call
        with patch.object(
            pipeline,
            "_call_llm_with_fallback",
            new_callable=AsyncMock,
            return_value=(
                json.dumps([{"action": "Visit store", "priority": 80}]),
                "llama3.1:8b",
            ),
        ):
            result = await pipeline.query(
                query_text="Generate tasks for store",
                collection="store_profiles",
                filters={"company_id": "company-001"},
            )

        assert "result" in result
        assert "sources" in result
        assert "model_used" in result
        assert result["model_used"] == "llama3.1:8b"
        assert isinstance(result["sources"], list)
        assert len(result["sources"]) == 2  # From mock retriever

    @pytest.mark.asyncio
    async def test_query_with_template(
        self, mock_qdrant_retriever: MagicMock, test_settings: Settings
    ) -> None:
        """RAG query should use Jinja2 template when provided."""
        pipeline = RAGPipeline(
            retriever=mock_qdrant_retriever,
            settings=test_settings,
        )

        template = Template("Store: {{ store_name }}\nContext: {{ rag_context }}")

        with patch.object(
            pipeline,
            "_call_llm_with_fallback",
            new_callable=AsyncMock,
            return_value=('{"result": "ok"}', "llama3.1:8b"),
        ) as mock_llm:
            await pipeline.query(
                query_text="tasks",
                collection="store_profiles",
                prompt_template=template,
                template_vars={"store_name": "Sharma Store"},
            )

            # Verify the prompt was built from the template
            call_args = mock_llm.call_args
            prompt = call_args[0][0]
            assert "Store: Sharma Store" in prompt
            assert "Context:" in prompt

    @pytest.mark.asyncio
    async def test_query_continues_without_retriever(
        self, test_settings: Settings
    ) -> None:
        """Query should succeed even with no retriever configured."""
        pipeline = RAGPipeline(retriever=None, settings=test_settings)

        with patch.object(
            pipeline,
            "_call_llm_with_fallback",
            new_callable=AsyncMock,
            return_value=('{"answer": "test"}', "llama3.1:8b"),
        ):
            result = await pipeline.query(
                query_text="test",
                collection="store_profiles",
            )

        assert result["sources"] == []
        assert result["result"] == {"answer": "test"}

    @pytest.mark.asyncio
    async def test_query_handles_retriever_failure(
        self, test_settings: Settings
    ) -> None:
        """If retriever raises, query should continue with empty context."""
        retriever = MagicMock(spec=QdrantRetriever)
        retriever.search.side_effect = Exception("Qdrant connection error")

        pipeline = RAGPipeline(retriever=retriever, settings=test_settings)

        with patch.object(
            pipeline,
            "_call_llm_with_fallback",
            new_callable=AsyncMock,
            return_value=('{"fallback": true}', "llama3.1:8b"),
        ):
            result = await pipeline.query(
                query_text="tasks",
                collection="store_profiles",
            )

        assert result["sources"] == []
        assert result["result"]["fallback"] is True


# ── LLM Fallback Chain Tests ─────────────────────────────────────────────────


class TestLLMFallbackChain:
    """Test the LLM fallback chain logic."""

    @pytest.mark.asyncio
    async def test_uses_default_model_first(self, test_settings: Settings) -> None:
        pipeline = RAGPipeline(settings=test_settings)

        with patch.object(
            pipeline,
            "_call_ollama",
            new_callable=AsyncMock,
            return_value="response",
        ) as mock_ollama:
            response, model = await pipeline._call_llm_with_fallback("test prompt")
            assert response == "response"
            assert model == test_settings.DEFAULT_MODEL
            mock_ollama.assert_called_once()

    @pytest.mark.asyncio
    async def test_falls_back_to_fast_model(self, test_settings: Settings) -> None:
        pipeline = RAGPipeline(settings=test_settings)

        call_count = 0

        async def side_effect(prompt: str, model: str, *args: Any) -> str:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise ConnectionError("Default model unavailable")
            return "fast response"

        with patch.object(pipeline, "_call_ollama", side_effect=side_effect):
            response, model = await pipeline._call_llm_with_fallback("test")
            assert response == "fast response"
            assert model == test_settings.FAST_MODEL

    @pytest.mark.asyncio
    async def test_raises_when_all_providers_fail(
        self, test_settings: Settings
    ) -> None:
        pipeline = RAGPipeline(settings=test_settings)

        with patch.object(
            pipeline,
            "_call_ollama",
            new_callable=AsyncMock,
            side_effect=Exception("fail"),
        ):
            with pytest.raises(RuntimeError, match="All LLM providers failed"):
                await pipeline._call_llm_with_fallback("test")
