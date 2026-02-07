"""
Supervisor agent using LangGraph StateGraph.

The supervisor is the entry-point agent that:
1. Detects the user's intent from their message.
2. Routes to the appropriate specialist agent.
3. Handles fallback / general queries directly.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END, StateGraph

from app.agents.state import AgentState, ChatRequest, ChatResponse, Intent
from app.core.config import get_settings
from app.rag.pipeline import RAGPipeline

logger = logging.getLogger(__name__)

# Intent detection prompt
INTENT_DETECTION_PROMPT = """\
You are an intent classifier for an Indian CPG/FMCG sales platform.
Classify the following message into exactly ONE intent.

## Available Intents
- order: placing a new order, adding items, modifying quantities
- order_status: checking order status, delivery tracking
- coaching: sales training, role-play, skill improvement
- analytics: data questions, reports, KPI queries, sales trends
- collection: payment reminders, outstanding dues, invoice queries
- promotion: designing promotions, discount offers, schemes
- greeting: hello, hi, good morning, namaste
- general: anything else, product info, complaints, feedback

## Message
"{message}"

## User Type: {user_type}
## Language: {language}

Respond with ONLY valid JSON:
{{"intent": "string", "confidence": 0.0-1.0, "language_detected": "en|hi|hinglish"}}
"""


class SupervisorAgent:
    """LangGraph supervisor that routes to specialist agents."""

    def __init__(self, rag_pipeline: RAGPipeline | None = None) -> None:
        self._rag = rag_pipeline or RAGPipeline()
        self._settings = get_settings()
        self._graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        """Construct the supervisor StateGraph."""
        graph = StateGraph(AgentState)

        # Nodes
        graph.add_node("detect_intent", self._detect_intent)
        graph.add_node("route_to_agent", self._route_to_agent)
        graph.add_node("handle_order", self._handle_order)
        graph.add_node("handle_coaching", self._handle_coaching)
        graph.add_node("handle_analytics", self._handle_analytics)
        graph.add_node("handle_collection", self._handle_collection)
        graph.add_node("handle_promotion", self._handle_promotion)
        graph.add_node("handle_general", self._handle_general)
        graph.add_node("handle_greeting", self._handle_greeting)

        # Entry point
        graph.set_entry_point("detect_intent")

        # Edges
        graph.add_edge("detect_intent", "route_to_agent")

        # Conditional routing
        graph.add_conditional_edges(
            "route_to_agent",
            self._get_route,
            {
                Intent.ORDER: "handle_order",
                Intent.ORDER_STATUS: "handle_order",
                Intent.COACHING: "handle_coaching",
                Intent.ANALYTICS: "handle_analytics",
                Intent.COLLECTION: "handle_collection",
                Intent.PROMOTION: "handle_promotion",
                Intent.GENERAL: "handle_general",
                Intent.GREETING: "handle_greeting",
                Intent.UNKNOWN: "handle_general",
            },
        )

        # All handlers go to END
        for node in [
            "handle_order", "handle_coaching", "handle_analytics",
            "handle_collection", "handle_promotion",
            "handle_general", "handle_greeting",
        ]:
            graph.add_edge(node, END)

        return graph

    def get_compiled_graph(self):
        """Return the compiled graph for invocation."""
        return self._graph.compile()

    async def run(self, request: ChatRequest) -> ChatResponse:
        """Execute the supervisor agent on a chat request.

        Args:
            request: The incoming chat message and context.

        Returns:
            A ``ChatResponse`` with the agent's reply.
        """
        # Initialise state
        initial_state: AgentState = {
            "session_id": request.session_id,
            "user_type": request.user_type,
            "user_id": request.user_id,
            "company_id": request.company_id,
            "language": request.language,
            "messages": [HumanMessage(content=request.message)],
            "input": request.message,
            "context": request.context,
            "tools_output": {},
            "current_intent": Intent.UNKNOWN,
            "confidence": 0.0,
            "target_agent": "",
            "escalate": False,
            "error": None,
            "order_items": [],
            "matched_products": [],
            "inventory_status": [],
            "sql_query": "",
            "sql_result": [],
            "scenario": {},
            "score": 0.0,
            "feedback": "",
            "response": "",
            "structured_output": {},
            "metadata": {},
        }

        compiled = self.get_compiled_graph()
        final_state = await compiled.ainvoke(initial_state)

        return ChatResponse(
            session_id=request.session_id,
            response=final_state.get("response", "I could not process your request."),
            intent=final_state.get("current_intent", Intent.UNKNOWN),
            confidence=final_state.get("confidence", 0.0),
            structured_output=final_state.get("structured_output", {}),
            agent_used=final_state.get("target_agent", "supervisor"),
            escalated=final_state.get("escalate", False),
            metadata=final_state.get("metadata", {}),
        )

    # ── Node Functions ────────────────────────────────────────────────

    async def _detect_intent(self, state: AgentState) -> dict[str, Any]:
        """Detect the user's intent using the LLM."""
        user_message = state.get("input", "")
        user_type = state.get("user_type", "rep")
        language = state.get("language", "en")

        prompt = INTENT_DETECTION_PROMPT.format(
            message=user_message,
            user_type=user_type,
            language=language,
        )

        try:
            raw_response = await self._rag.generate(
                prompt,
                model=self._settings.FAST_MODEL,
                temperature=0.0,
                max_tokens=100,
            )

            parsed = self._parse_intent_response(raw_response)
            intent = parsed.get("intent", Intent.UNKNOWN)
            confidence = float(parsed.get("confidence", 0.5))

            # Validate intent
            if intent not in Intent.ALL:
                intent = Intent.UNKNOWN
                confidence = 0.3

            logger.info(
                "Intent detected: '%s' (confidence=%.2f) for message: '%s'",
                intent,
                confidence,
                user_message[:80],
            )

            return {
                "current_intent": intent,
                "confidence": confidence,
                "language": parsed.get("language_detected", language),
            }

        except Exception:
            logger.warning("Intent detection failed, defaulting to 'general'.")
            return {
                "current_intent": Intent.GENERAL,
                "confidence": 0.3,
            }

    async def _route_to_agent(self, state: AgentState) -> dict[str, Any]:
        """Set the target agent based on detected intent."""
        intent = state.get("current_intent", Intent.UNKNOWN)
        agent_map = {
            Intent.ORDER: "order_agent",
            Intent.ORDER_STATUS: "order_agent",
            Intent.COACHING: "coach_agent",
            Intent.ANALYTICS: "analytics_agent",
            Intent.COLLECTION: "collection_agent",
            Intent.PROMOTION: "promo_agent",
            Intent.GREETING: "supervisor",
            Intent.GENERAL: "supervisor",
            Intent.UNKNOWN: "supervisor",
        }
        target = agent_map.get(intent, "supervisor")
        logger.debug("Routing to agent: %s (intent=%s)", target, intent)
        return {"target_agent": target}

    def _get_route(self, state: AgentState) -> str:
        """Conditional edge function — returns the intent for routing."""
        return state.get("current_intent", Intent.UNKNOWN)

    async def _handle_order(self, state: AgentState) -> dict[str, Any]:
        """Delegate to the OrderAgent."""
        try:
            from app.agents.order_agent import OrderAgent

            agent = OrderAgent(rag_pipeline=self._rag)
            result = await agent.process(state)
            return result
        except Exception as exc:
            logger.exception("OrderAgent failed.")
            return {
                "response": "I had trouble processing your order. Could you please try again?",
                "error": str(exc),
            }

    async def _handle_coaching(self, state: AgentState) -> dict[str, Any]:
        """Delegate to the CoachAgent."""
        try:
            from app.agents.coach_agent import CoachAgent

            agent = CoachAgent(rag_pipeline=self._rag)
            result = await agent.process(state)
            return result
        except Exception as exc:
            logger.exception("CoachAgent failed.")
            return {
                "response": "I couldn't start the coaching session. Please try again.",
                "error": str(exc),
            }

    async def _handle_analytics(self, state: AgentState) -> dict[str, Any]:
        """Delegate to the AnalyticsAgent."""
        try:
            from app.agents.analytics_agent import AnalyticsAgent

            agent = AnalyticsAgent(rag_pipeline=self._rag)
            result = await agent.process(state)
            return result
        except Exception as exc:
            logger.exception("AnalyticsAgent failed.")
            return {
                "response": "I couldn't process your analytics query. Please try again.",
                "error": str(exc),
            }

    async def _handle_collection(self, state: AgentState) -> dict[str, Any]:
        """Delegate to the CollectionAgent."""
        try:
            from app.agents.collection_agent import CollectionAgent

            agent = CollectionAgent(rag_pipeline=self._rag)
            result = await agent.process(state)
            return result
        except Exception as exc:
            logger.exception("CollectionAgent failed.")
            return {
                "response": "Payment collection service is temporarily unavailable.",
                "error": str(exc),
            }

    async def _handle_promotion(self, state: AgentState) -> dict[str, Any]:
        """Delegate to the PromoAgent."""
        try:
            from app.agents.promo_agent import PromoAgent

            agent = PromoAgent(rag_pipeline=self._rag)
            result = await agent.process(state)
            return result
        except Exception as exc:
            logger.exception("PromoAgent failed.")
            return {
                "response": "Promotion design service is temporarily unavailable.",
                "error": str(exc),
            }

    async def _handle_general(self, state: AgentState) -> dict[str, Any]:
        """Handle general queries directly."""
        user_message = state.get("input", "")
        language = state.get("language", "en")

        prompt = (
            f"You are a helpful assistant for an Indian CPG/FMCG sales platform. "
            f"Respond in {'Hindi' if language == 'hi' else 'English'} to this query:\n\n"
            f"\"{user_message}\"\n\n"
            f"Be concise, helpful, and professional."
        )

        try:
            response = await self._rag.generate(prompt, temperature=0.3)
            return {"response": response}
        except Exception:
            return {
                "response": (
                    "Thank you for your message. How can I help you today? "
                    "I can assist with orders, analytics, coaching, and more."
                ),
            }

    async def _handle_greeting(self, state: AgentState) -> dict[str, Any]:
        """Handle greeting messages."""
        language = state.get("language", "en")
        user_type = state.get("user_type", "rep")

        if language == "hi":
            greeting = "Namaste! Main aapki kaise madad kar sakta hoon?"
        else:
            greeting = "Hello! How can I help you today?"

        capabilities = {
            "rep": "I can help you with orders, store tasks, coaching, and analytics.",
            "retailer": "I can help you place orders, check order status, and view your account.",
            "manager": "I can help you with analytics, team performance, and reports.",
        }

        response = f"{greeting} {capabilities.get(user_type, capabilities['rep'])}"
        return {"response": response}

    @staticmethod
    def _parse_intent_response(raw: str) -> dict[str, Any]:
        """Parse the LLM's intent detection response."""
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        # Try extracting JSON from the response
        import re

        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        # Keyword fallback
        lower = raw.lower()
        for intent in Intent.ALL:
            if intent in lower:
                return {"intent": intent, "confidence": 0.5}

        return {"intent": Intent.UNKNOWN, "confidence": 0.3}
