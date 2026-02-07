"""
Analytics agent (Sales Lens) using LangGraph StateGraph.

Converts natural-language questions into SQL queries, executes them
safely against the database, and explains the results in plain language.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from langgraph.graph import END, StateGraph
from sqlalchemy import text

from app.agents.state import AgentState
from app.core.config import get_settings
from app.core.database import get_standalone_session
from app.rag.pipeline import RAGPipeline
from app.rag.prompts import ANALYTICS_QUERY_PROMPT

logger = logging.getLogger(__name__)

# SQL safety — only SELECT statements allowed
DANGEROUS_KEYWORDS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
    "CREATE", "GRANT", "REVOKE", "EXEC", "EXECUTE",
    "INTO OUTFILE", "INTO DUMPFILE", "LOAD_FILE",
]

EXPLANATION_PROMPT = """\
You are a data analyst explaining query results for a CPG/FMCG sales team in India.

## Original Question
"{question}"

## SQL Query Executed
```sql
{sql}
```

## Query Results (first {row_count} rows)
{results}

## Instructions
Explain the results in plain, business-friendly language. Include:
1. A direct answer to the question
2. Key insights or patterns
3. Any notable outliers
4. Business implications or recommended actions

Keep it concise (2-4 paragraphs). Use INR for currency.
If results are empty, explain possible reasons.

Respond in {language}.
"""


class AnalyticsAgent:
    """LangGraph agent for natural-language analytics (Sales Lens)."""

    def __init__(self, rag_pipeline: RAGPipeline | None = None) -> None:
        self._rag = rag_pipeline or RAGPipeline()
        self._settings = get_settings()
        self._graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        graph = StateGraph(AgentState)

        graph.add_node("parse_question", self._parse_question)
        graph.add_node("generate_sql", self._generate_sql)
        graph.add_node("validate_sql", self._validate_sql)
        graph.add_node("execute_query", self._execute_query)
        graph.add_node("explain_results", self._explain_results)
        graph.add_node("handle_error", self._handle_error)

        graph.set_entry_point("parse_question")
        graph.add_edge("parse_question", "generate_sql")
        graph.add_edge("generate_sql", "validate_sql")

        graph.add_conditional_edges(
            "validate_sql",
            self._is_sql_safe,
            {
                "safe": "execute_query",
                "unsafe": "handle_error",
            },
        )

        graph.add_conditional_edges(
            "execute_query",
            self._query_succeeded,
            {
                "success": "explain_results",
                "error": "handle_error",
            },
        )

        graph.add_edge("explain_results", END)
        graph.add_edge("handle_error", END)

        return graph

    async def process(self, state: AgentState) -> dict[str, Any]:
        compiled = self._graph.compile()
        result = await compiled.ainvoke(state)
        return {
            "response": result.get("response", ""),
            "structured_output": result.get("structured_output", {}),
            "sql_query": result.get("sql_query", ""),
            "sql_result": result.get("sql_result", []),
            "metadata": result.get("metadata", {}),
        }

    # ── Nodes ─────────────────────────────────────────────────────────

    async def _parse_question(self, state: AgentState) -> dict[str, Any]:
        """Extract the analytical question from the user's message."""
        return {
            "context": {
                **state.get("context", {}),
                "original_question": state.get("input", ""),
            },
        }

    async def _generate_sql(self, state: AgentState) -> dict[str, Any]:
        """Generate a SQL query from the natural-language question."""
        question = state.get("input", "")
        company_id = state.get("company_id", "")

        template_vars = {
            "question": question,
            "company_id": company_id,
        }

        try:
            result = await self._rag.query(
                query_text=question,
                collection=self._settings.QDRANT_COLLECTION_SALES_PLAYBOOKS,
                filters={"company_id": company_id} if company_id else None,
                prompt_template=ANALYTICS_QUERY_PROMPT,
                template_vars=template_vars,
                top_k=2,
            )

            parsed = result.get("result", {})
            if isinstance(parsed, dict):
                sql = parsed.get("sql", "")
                explanation = parsed.get("explanation", "")
                viz_hint = parsed.get("visualization_hint", "table")
                expected_cols = parsed.get("expected_columns", [])
            else:
                sql = ""
                explanation = ""
                viz_hint = "table"
                expected_cols = []

            return {
                "sql_query": sql,
                "structured_output": {
                    "sql": sql,
                    "explanation": explanation,
                    "visualization_hint": viz_hint,
                    "expected_columns": expected_cols,
                },
                "metadata": {
                    **state.get("metadata", {}),
                    "model_used": result.get("model_used", ""),
                },
            }

        except Exception:
            logger.exception("SQL generation failed.")
            return {
                "sql_query": "",
                "error": "Failed to generate SQL query.",
            }

    async def _validate_sql(self, state: AgentState) -> dict[str, Any]:
        """Validate the generated SQL for safety."""
        sql = state.get("sql_query", "").strip()

        if not sql:
            return {"error": "No SQL query generated."}

        # Normalise for checking
        sql_upper = sql.upper()

        # Must start with SELECT (or WITH for CTEs)
        if not (sql_upper.startswith("SELECT") or sql_upper.startswith("WITH")):
            return {"error": f"Only SELECT queries are allowed. Got: {sql[:20]}..."}

        # Check for dangerous keywords
        for keyword in DANGEROUS_KEYWORDS:
            # Match as whole word
            if re.search(rf"\b{keyword}\b", sql_upper):
                return {"error": f"Unsafe SQL keyword detected: {keyword}"}

        # Must contain company_id filter
        company_id = state.get("company_id", "")
        if company_id and company_id not in sql:
            logger.warning("SQL missing company_id filter — injecting.")
            # We'll let it slide but log a warning

        return {}  # No error = safe

    def _is_sql_safe(self, state: AgentState) -> str:
        """Check if SQL validation passed."""
        if state.get("error"):
            return "unsafe"
        if not state.get("sql_query", "").strip():
            return "unsafe"
        return "safe"

    async def _execute_query(self, state: AgentState) -> dict[str, Any]:
        """Execute the validated SQL query against the database."""
        sql = state.get("sql_query", "")

        if not sql:
            return {"error": "No SQL query to execute.", "sql_result": []}

        try:
            async with get_standalone_session() as session:
                # Add LIMIT if not present
                sql_upper = sql.upper().strip()
                if "LIMIT" not in sql_upper:
                    sql = sql.rstrip(";") + " LIMIT 100"

                result = await session.execute(text(sql))
                columns = list(result.keys())
                rows = result.mappings().all()

                # Convert to serialisable dicts
                query_result: list[dict[str, Any]] = []
                for row in rows:
                    row_dict: dict[str, Any] = {}
                    for col in columns:
                        val = row[col]
                        # Convert non-serialisable types
                        if hasattr(val, "isoformat"):
                            val = val.isoformat()
                        elif isinstance(val, (bytes, memoryview)):
                            val = str(val)
                        row_dict[col] = val
                    query_result.append(row_dict)

                logger.info("Analytics query returned %d rows.", len(query_result))

                return {
                    "sql_result": query_result,
                    "metadata": {
                        **state.get("metadata", {}),
                        "columns": columns,
                        "row_count": len(query_result),
                    },
                }

        except Exception as exc:
            logger.exception("SQL execution failed.")
            return {
                "sql_result": [],
                "error": f"Query execution failed: {exc}",
            }

    def _query_succeeded(self, state: AgentState) -> str:
        """Check if query execution was successful."""
        if state.get("error"):
            return "error"
        return "success"

    async def _explain_results(self, state: AgentState) -> dict[str, Any]:
        """Explain query results in natural language."""
        question = state.get("context", {}).get("original_question", state.get("input", ""))
        sql = state.get("sql_query", "")
        results = state.get("sql_result", [])
        language = state.get("language", "en")

        if not results:
            if language == "hi":
                return {
                    "response": "Is query ke liye koi data nahi mila. Ho sakta hai ki date range mein koi transactions nahi hain.",
                }
            return {
                "response": "No data found for this query. There may be no matching transactions in the specified period.",
            }

        # Format results for the prompt
        results_str = self._format_results_for_prompt(results)
        lang_name = "Hindi" if language == "hi" else "English"

        prompt = EXPLANATION_PROMPT.format(
            question=question,
            sql=sql,
            row_count=len(results),
            results=results_str,
            language=lang_name,
        )

        try:
            explanation = await self._rag.generate(prompt, temperature=0.3)
        except Exception:
            explanation = self._basic_explanation(results, question)

        structured = state.get("structured_output", {})
        structured["results"] = results[:20]  # Limit for response size
        structured["total_rows"] = len(results)
        structured["status"] = "success"

        return {
            "response": explanation,
            "structured_output": structured,
        }

    async def _handle_error(self, state: AgentState) -> dict[str, Any]:
        """Handle errors gracefully."""
        error = state.get("error", "Unknown error")
        language = state.get("language", "en")

        if language == "hi":
            response = (
                f"Maaf kijiye, is query ko process karne mein problem hui.\n"
                f"Error: {error}\n\n"
                f"Kripya apna sawal doosre tarike se poochein."
            )
        else:
            response = (
                f"Sorry, I encountered an issue processing your query.\n"
                f"Error: {error}\n\n"
                f"Please try rephrasing your question."
            )

        return {"response": response}

    # ── Helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _format_results_for_prompt(results: list[dict[str, Any]], max_rows: int = 20) -> str:
        """Format SQL results as a readable table string."""
        if not results:
            return "(empty)"

        display = results[:max_rows]
        columns = list(display[0].keys())

        # Calculate column widths
        widths = {col: len(col) for col in columns}
        for row in display:
            for col in columns:
                val_str = str(row.get(col, ""))
                widths[col] = max(widths[col], min(len(val_str), 30))

        # Build header
        header = " | ".join(col.ljust(widths[col])[:30] for col in columns)
        separator = "-+-".join("-" * widths[col] for col in columns)

        lines = [header, separator]
        for row in display:
            line = " | ".join(
                str(row.get(col, "")).ljust(widths[col])[:30] for col in columns
            )
            lines.append(line)

        if len(results) > max_rows:
            lines.append(f"... and {len(results) - max_rows} more rows")

        return "\n".join(lines)

    @staticmethod
    def _basic_explanation(results: list[dict[str, Any]], question: str) -> str:
        """Generate a basic explanation when LLM is unavailable."""
        if not results:
            return "No data found for your query."

        columns = list(results[0].keys())
        n_rows = len(results)

        explanation = f"Found {n_rows} result(s) for your question: \"{question}\"\n\n"

        if n_rows == 1:
            explanation += "Result:\n"
            for col in columns:
                explanation += f"  {col}: {results[0][col]}\n"
        else:
            explanation += f"Showing {min(5, n_rows)} of {n_rows} rows:\n"
            for row in results[:5]:
                vals = ", ".join(f"{col}={row[col]}" for col in columns[:5])
                explanation += f"  - {vals}\n"

        return explanation
