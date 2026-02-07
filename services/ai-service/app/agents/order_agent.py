"""
Order processing agent using LangGraph StateGraph.

Handles the end-to-end order flow:
  1. Parse natural-language order text into structured items.
  2. Match items against the product catalog (fuzzy matching).
  3. Check inventory availability.
  4. Build an order confirmation message.
  5. Create the order in the system.

Supports text, transcribed voice, and OCR-parsed image orders.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langgraph.graph import END, StateGraph

from app.agents.state import AgentState, Intent
from app.core.config import get_settings
from app.rag.pipeline import RAGPipeline
from app.rag.prompts import ORDER_PARSER_PROMPT

logger = logging.getLogger(__name__)


class OrderAgent:
    """LangGraph agent for order processing."""

    def __init__(self, rag_pipeline: RAGPipeline | None = None) -> None:
        self._rag = rag_pipeline or RAGPipeline()
        self._settings = get_settings()
        self._graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        """Construct the order-processing StateGraph."""
        graph = StateGraph(AgentState)

        graph.add_node("parse_order", self._parse_order)
        graph.add_node("match_catalog", self._match_catalog)
        graph.add_node("check_inventory", self._check_inventory)
        graph.add_node("build_confirmation", self._build_confirmation)
        graph.add_node("request_clarification", self._request_clarification)

        graph.set_entry_point("parse_order")

        graph.add_edge("parse_order", "match_catalog")

        # After catalog matching, check if all items have high confidence
        graph.add_conditional_edges(
            "match_catalog",
            self._needs_clarification,
            {
                "proceed": "check_inventory",
                "clarify": "request_clarification",
            },
        )

        graph.add_conditional_edges(
            "check_inventory",
            self._inventory_available,
            {
                "available": "build_confirmation",
                "partial": "build_confirmation",
                "unavailable": "build_confirmation",
            },
        )

        graph.add_edge("build_confirmation", END)
        graph.add_edge("request_clarification", END)

        return graph

    async def process(self, state: AgentState) -> dict[str, Any]:
        """Run the order agent graph on the current state."""
        compiled = self._graph.compile()
        result = await compiled.ainvoke(state)
        return {
            "response": result.get("response", ""),
            "structured_output": result.get("structured_output", {}),
            "order_items": result.get("order_items", []),
            "matched_products": result.get("matched_products", []),
            "metadata": result.get("metadata", {}),
        }

    # ── Nodes ─────────────────────────────────────────────────────────

    async def _parse_order(self, state: AgentState) -> dict[str, Any]:
        """Parse natural-language order text into structured items."""
        order_text = state.get("input", "")
        user_id = state.get("user_id", "")
        company_id = state.get("company_id", "")
        language = state.get("language", "en")

        # Get store context (usual products, name, etc.)
        store_context = state.get("context", {})
        store_id = store_context.get("store_id", user_id)
        store_name = store_context.get("store_name", "")
        usual_products = store_context.get("usual_products", "Not available")

        template_vars = {
            "store_id": store_id,
            "store_name": store_name,
            "usual_products": usual_products,
            "language": language,
            "order_text": order_text,
        }

        try:
            result = await self._rag.query(
                query_text=order_text,
                collection=self._settings.QDRANT_COLLECTION_PRODUCT_CATALOG,
                filters={"company_id": company_id} if company_id else None,
                prompt_template=ORDER_PARSER_PROMPT,
                template_vars=template_vars,
                top_k=10,
            )

            parsed = result.get("result", {})

            if isinstance(parsed, dict):
                items = parsed.get("items", [])
                notes = parsed.get("notes", "")
            elif isinstance(parsed, list):
                items = parsed
                notes = ""
            else:
                items = []
                notes = ""

            logger.info("Parsed %d order items from message.", len(items))

            return {
                "order_items": items,
                "metadata": {
                    **state.get("metadata", {}),
                    "parser_notes": notes,
                    "model_used": result.get("model_used", ""),
                    "sources": result.get("sources", []),
                },
            }

        except Exception:
            logger.exception("Order parsing failed.")
            return {
                "order_items": [],
                "error": "Failed to parse order text.",
            }

    async def _match_catalog(self, state: AgentState) -> dict[str, Any]:
        """Match parsed items against the product catalog."""
        items = state.get("order_items", [])
        company_id = state.get("company_id", "")

        if not items:
            return {
                "matched_products": [],
                "response": "I couldn't identify any products in your message. Could you please try again?",
            }

        matched: list[dict[str, Any]] = []

        for item in items:
            product_name = item.get("product_name_raw", item.get("product_name_matched", ""))
            confidence = float(item.get("confidence", 0.0))

            # If the parser already matched with high confidence, use it
            if confidence >= 0.8 and item.get("product_id"):
                matched.append({
                    **item,
                    "match_status": "confirmed",
                })
                continue

            # Use RAG to find the best catalog match
            try:
                if self._rag._retriever is not None:
                    results = self._rag._retriever.search(
                        collection=self._settings.QDRANT_COLLECTION_PRODUCT_CATALOG,
                        query_text=product_name,
                        filters={"company_id": company_id} if company_id else None,
                        top_k=3,
                    )

                    if results and results[0].score >= 0.7:
                        best = results[0]
                        matched.append({
                            **item,
                            "product_id": best.metadata.get("product_id", best.id),
                            "product_name_matched": best.content or best.metadata.get("name", ""),
                            "sku_code": best.metadata.get("sku_code", ""),
                            "confidence": round(best.score, 3),
                            "match_status": "auto_matched" if best.score >= 0.85 else "needs_review",
                            "alternatives": [
                                {
                                    "name": r.content or r.metadata.get("name", ""),
                                    "score": round(r.score, 3),
                                    "product_id": r.metadata.get("product_id", r.id),
                                }
                                for r in results[1:]
                            ],
                        })
                    else:
                        matched.append({
                            **item,
                            "match_status": "not_found",
                            "confidence": 0.0,
                        })
                else:
                    # No retriever available — pass through parser's match
                    matched.append({
                        **item,
                        "match_status": "parser_only",
                    })

            except Exception:
                logger.warning("Catalog matching failed for '%s'.", product_name)
                matched.append({
                    **item,
                    "match_status": "error",
                    "confidence": 0.0,
                })

        return {"matched_products": matched}

    def _needs_clarification(self, state: AgentState) -> str:
        """Check if any matched products need clarification."""
        matched = state.get("matched_products", [])
        if not matched:
            return "clarify"

        low_confidence = [
            m for m in matched
            if float(m.get("confidence", 0)) < 0.7
            or m.get("match_status") in ("not_found", "needs_review")
        ]

        if low_confidence:
            return "clarify"
        return "proceed"

    async def _check_inventory(self, state: AgentState) -> dict[str, Any]:
        """Check inventory availability for matched products."""
        matched = state.get("matched_products", [])

        # In a real system, this would call the inventory service.
        # For now, mark all as available (the actual check happens in the
        # backend eb2b-service when the order is created).
        inventory_status: list[dict[str, Any]] = []

        for item in matched:
            inventory_status.append({
                "product_id": item.get("product_id", ""),
                "product_name": item.get("product_name_matched", item.get("product_name_raw", "")),
                "requested_qty": item.get("quantity", 0),
                "available_qty": item.get("quantity", 0),  # Assume available
                "status": "available",
            })

        return {"inventory_status": inventory_status}

    def _inventory_available(self, state: AgentState) -> str:
        """Check overall inventory availability."""
        statuses = state.get("inventory_status", [])
        if not statuses:
            return "unavailable"

        all_available = all(s.get("status") == "available" for s in statuses)
        any_available = any(s.get("status") == "available" for s in statuses)

        if all_available:
            return "available"
        elif any_available:
            return "partial"
        else:
            return "unavailable"

    async def _build_confirmation(self, state: AgentState) -> dict[str, Any]:
        """Build the order confirmation message."""
        matched = state.get("matched_products", [])
        inventory = state.get("inventory_status", [])
        language = state.get("language", "en")

        if not matched:
            return {
                "response": "No products could be matched. Please try again.",
                "structured_output": {"status": "failed", "items": []},
            }

        # Build order summary
        lines: list[str] = []
        total_value = 0.0
        order_items: list[dict[str, Any]] = []

        for item in matched:
            name = item.get("product_name_matched", item.get("product_name_raw", "Unknown"))
            qty = item.get("quantity", 0)
            unit = item.get("unit", "pieces")
            sku = item.get("sku_code", "")

            inv_item = next(
                (i for i in inventory if i.get("product_id") == item.get("product_id")),
                {},
            )
            status = inv_item.get("status", "available")

            if status == "available":
                status_icon = "[OK]"
            elif status == "partial":
                status_icon = "[PARTIAL]"
            else:
                status_icon = "[N/A]"

            line = f"  {status_icon} {name} ({sku}) x {qty} {unit}"
            lines.append(line)

            order_items.append({
                "product_id": item.get("product_id", ""),
                "product_name": name,
                "sku_code": sku,
                "quantity": qty,
                "unit": unit,
                "status": status,
            })

        items_text = "\n".join(lines)

        if language == "hi":
            response = (
                f"Aapka order summary:\n\n{items_text}\n\n"
                f"Kya aap is order ko confirm karna chahte hain? (Haan/Nahi)"
            )
        else:
            response = (
                f"Your order summary:\n\n{items_text}\n\n"
                f"Would you like to confirm this order? (Yes/No)"
            )

        return {
            "response": response,
            "structured_output": {
                "status": "pending_confirmation",
                "items": order_items,
                "total_items": len(order_items),
            },
        }

    async def _request_clarification(self, state: AgentState) -> dict[str, Any]:
        """Ask the user to clarify ambiguous products."""
        matched = state.get("matched_products", [])
        language = state.get("language", "en")

        unclear: list[dict[str, Any]] = []
        for item in matched:
            if float(item.get("confidence", 0)) < 0.7 or item.get("match_status") in ("not_found", "needs_review"):
                unclear.append(item)

        if not unclear:
            return {"response": "Your order looks good. Processing..."}

        clarification_lines: list[str] = []
        for item in unclear:
            raw_name = item.get("product_name_raw", "Unknown")
            alternatives = item.get("alternatives", [])

            if alternatives:
                alt_names = ", ".join(a["name"] for a in alternatives[:3])
                if language == "hi":
                    clarification_lines.append(
                        f"'{raw_name}' se kya matlab hai? Kya aap ye chahte hain: {alt_names}?"
                    )
                else:
                    clarification_lines.append(
                        f"By '{raw_name}', did you mean: {alt_names}?"
                    )
            else:
                if language == "hi":
                    clarification_lines.append(
                        f"'{raw_name}' hamari catalog mein nahi mila. Kya aap product ka poora naam bata sakte hain?"
                    )
                else:
                    clarification_lines.append(
                        f"I couldn't find '{raw_name}' in our catalog. Could you provide the full product name?"
                    )

        clarification_text = "\n".join(clarification_lines)

        if language == "hi":
            response = f"Kuch products ke baare mein clarity chahiye:\n\n{clarification_text}"
        else:
            response = f"I need some clarification:\n\n{clarification_text}"

        return {
            "response": response,
            "structured_output": {
                "status": "needs_clarification",
                "unclear_items": unclear,
            },
        }
