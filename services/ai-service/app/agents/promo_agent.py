"""
Promotion design agent using LangGraph StateGraph.

Designs trade promotions based on historical performance data,
market context, and budget constraints. Optimises for ROI using
past promotion response rates.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langgraph.graph import END, StateGraph

from app.agents.state import AgentState
from app.core.config import get_settings
from app.rag.pipeline import RAGPipeline
from app.rag.prompts import PROMO_DESIGN_PROMPT

logger = logging.getLogger(__name__)


class PromoAgent:
    """LangGraph agent for promotion design and optimisation."""

    def __init__(self, rag_pipeline: RAGPipeline | None = None) -> None:
        self._rag = rag_pipeline or RAGPipeline()
        self._settings = get_settings()
        self._graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        graph = StateGraph(AgentState)

        graph.add_node("gather_context", self._gather_context)
        graph.add_node("design_promotion", self._design_promotion)
        graph.add_node("format_output", self._format_output)

        graph.set_entry_point("gather_context")
        graph.add_edge("gather_context", "design_promotion")
        graph.add_edge("design_promotion", "format_output")
        graph.add_edge("format_output", END)

        return graph

    async def process(self, state: AgentState) -> dict[str, Any]:
        compiled = self._graph.compile()
        result = await compiled.ainvoke(state)
        return {
            "response": result.get("response", ""),
            "structured_output": result.get("structured_output", {}),
            "metadata": result.get("metadata", {}),
        }

    # ── Nodes ─────────────────────────────────────────────────────────

    async def _gather_context(self, state: AgentState) -> dict[str, Any]:
        """Gather promotion design context from the user's message and DB."""
        user_message = state.get("input", "")
        company_id = state.get("company_id", "")
        context = state.get("context", {})

        # Extract parameters from the user's message
        # In production, these would be parsed from the message or provided via context
        promo_context = {
            "company_name": context.get("company_name", "Company"),
            "target_segment": context.get("target_segment", "all stores"),
            "budget": context.get("budget", 50000),
            "duration_days": context.get("duration_days", 14),
            "objective": context.get("objective", user_message),
            "product_focus": context.get("product_focus", "All categories"),
        }

        # Historical promo performance (would come from DB in production)
        historical_promos = context.get("historical_promos", (
            "- Volume Discount 10%: uptake 35%, ROI 2.1x (last quarter)\n"
            "- Buy 10 Get 1 Free: uptake 45%, ROI 2.8x (last quarter)\n"
            "- Display Incentive INR 500: uptake 25%, ROI 1.5x (last quarter)\n"
            "- Combo Deal (3 SKUs): uptake 30%, ROI 2.3x (last quarter)"
        ))

        # Market context
        market_context = context.get("market_context", (
            "Indian FMCG market, Tier 2-3 cities, price-sensitive retailers, "
            "monsoon season approaching, competitor launched new flavour variant."
        ))

        return {
            "context": {
                **context,
                "promo_context": promo_context,
                "historical_promos": historical_promos,
                "market_context": market_context,
            },
        }

    async def _design_promotion(self, state: AgentState) -> dict[str, Any]:
        """Design a promotion using the LLM."""
        context = state.get("context", {})
        promo_context = context.get("promo_context", {})
        company_id = state.get("company_id", "")

        template_vars = {
            "company_name": promo_context.get("company_name", "Company"),
            "target_segment": promo_context.get("target_segment", "all"),
            "budget": promo_context.get("budget", 50000),
            "duration_days": promo_context.get("duration_days", 14),
            "objective": promo_context.get("objective", "increase sales"),
            "historical_promos": context.get("historical_promos", ""),
            "product_details": promo_context.get("product_focus", ""),
            "market_context": context.get("market_context", ""),
        }

        try:
            result = await self._rag.query(
                query_text=f"promotion design {promo_context.get('objective', '')}",
                collection=self._settings.QDRANT_COLLECTION_SALES_PLAYBOOKS,
                filters={"company_id": company_id} if company_id else None,
                prompt_template=PROMO_DESIGN_PROMPT,
                template_vars=template_vars,
                top_k=3,
            )

            promo_design = result.get("result", {})
            if not isinstance(promo_design, dict):
                promo_design = self._default_promotion(promo_context)

            return {
                "structured_output": promo_design,
                "metadata": {
                    **state.get("metadata", {}),
                    "model_used": result.get("model_used", ""),
                },
            }

        except Exception:
            logger.warning("Promotion design failed, using default.")
            return {
                "structured_output": self._default_promotion(promo_context),
            }

    async def _format_output(self, state: AgentState) -> dict[str, Any]:
        """Format the promotion design into a human-readable response."""
        promo = state.get("structured_output", {})
        language = state.get("language", "en")

        if not promo:
            return {"response": "I couldn't design a promotion with the given parameters."}

        name = promo.get("promo_name", "Untitled Promotion")
        promo_type = promo.get("promo_type", "volume_discount")
        mechanics = promo.get("mechanics", "")
        target = promo.get("target_stores", "all")
        discount = promo.get("discount_pct", 0)
        min_qty = promo.get("minimum_qty", 0)
        free_goods = promo.get("free_goods_ratio", "")
        uptake = promo.get("estimated_uptake_pct", 0)
        revenue = promo.get("estimated_incremental_revenue_inr", 0)
        roi = promo.get("estimated_roi", 0)
        risks = promo.get("risks", [])
        start = promo.get("start_date", "")
        end = promo.get("end_date", "")

        response_parts = [
            f"## Promotion Proposal: {name}",
            f"**Type:** {promo_type.replace('_', ' ').title()}",
            f"**Mechanics:** {mechanics}",
            f"**Target Stores:** {target}",
        ]

        if discount > 0:
            response_parts.append(f"**Discount:** {discount}%")
        if min_qty > 0:
            response_parts.append(f"**Minimum Quantity:** {min_qty} units")
        if free_goods:
            response_parts.append(f"**Free Goods:** {free_goods}")
        if start and end:
            response_parts.append(f"**Duration:** {start} to {end}")

        response_parts.extend([
            "",
            "### Projected Impact",
            f"- Estimated Uptake: {uptake}%",
            f"- Incremental Revenue: INR {revenue:,.0f}",
            f"- Expected ROI: {roi}x",
        ])

        if risks:
            response_parts.append("\n### Risks")
            for risk in risks:
                response_parts.append(f"- {risk}")

        response_parts.append(
            "\n*Shall I adjust any parameters or generate an alternative design?*"
        )

        response = "\n".join(response_parts)

        return {
            "response": response,
            "structured_output": promo,
        }

    def _default_promotion(self, context: dict[str, Any]) -> dict[str, Any]:
        """Generate a default promotion when LLM is unavailable."""
        budget = float(context.get("budget", 50000))
        duration = int(context.get("duration_days", 14))

        return {
            "promo_name": "Volume Boost Campaign",
            "promo_type": "volume_discount",
            "mechanics": (
                f"Flat {min(15, max(5, int(budget / 10000)))}% discount on orders "
                f"above INR 2,000 for {duration} days."
            ),
            "target_stores": "top_20_pct",
            "target_channel": None,
            "products": [],
            "discount_pct": min(15, max(5, int(budget / 10000))),
            "minimum_qty": 24,
            "free_goods_ratio": None,
            "estimated_uptake_pct": 35.0,
            "estimated_incremental_revenue_inr": budget * 2.5,
            "estimated_roi": 2.5,
            "risks": [
                "May attract one-time bargain seekers without repeat purchases",
                "Competitive response risk",
            ],
            "start_date": "",
            "end_date": "",
        }
