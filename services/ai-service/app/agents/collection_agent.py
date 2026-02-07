"""
Payment collection agent using LangGraph StateGraph.

Handles payment collection conversations with retailers:
  - Sends polite but firm payment reminders
  - Handles payment promises, disputes, and refusals
  - Offers payment plans for large amounts
  - Escalates when necessary
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langgraph.graph import END, StateGraph

from app.agents.state import AgentState
from app.core.config import get_settings
from app.rag.pipeline import RAGPipeline
from app.rag.prompts import COLLECTION_CONVERSATION_PROMPT

logger = logging.getLogger(__name__)


class CollectionAgent:
    """LangGraph agent for payment collection conversations."""

    def __init__(self, rag_pipeline: RAGPipeline | None = None) -> None:
        self._rag = rag_pipeline or RAGPipeline()
        self._settings = get_settings()
        self._graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        graph = StateGraph(AgentState)

        graph.add_node("load_account", self._load_account)
        graph.add_node("generate_response", self._generate_response)
        graph.add_node("process_outcome", self._process_outcome)
        graph.add_node("escalate", self._escalate)

        graph.set_entry_point("load_account")
        graph.add_edge("load_account", "generate_response")

        graph.add_conditional_edges(
            "generate_response",
            self._should_escalate,
            {
                "continue": "process_outcome",
                "escalate": "escalate",
            },
        )

        graph.add_edge("process_outcome", END)
        graph.add_edge("escalate", END)

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

    async def _load_account(self, state: AgentState) -> dict[str, Any]:
        """Load the retailer's account and payment details from context."""
        context = state.get("context", {})

        # In production, these would be fetched from the database
        # based on user_id / store_id
        account_info = {
            "store_name": context.get("store_name", "Store"),
            "owner_name": context.get("owner_name", "Owner ji"),
            "outstanding_amount": float(context.get("outstanding_amount", 0)),
            "days_overdue": int(context.get("days_overdue", 0)),
            "credit_tier": context.get("credit_tier", "B"),
            "payment_history": context.get("payment_history", "Generally on-time payer"),
            "last_payment_date": context.get("last_payment_date", ""),
            "last_payment_amount": float(context.get("last_payment_amount", 0)),
        }

        return {
            "context": {**context, "account": account_info},
        }

    async def _generate_response(self, state: AgentState) -> dict[str, Any]:
        """Generate a collection response using the LLM."""
        context = state.get("context", {})
        account = context.get("account", {})
        latest_message = state.get("input", "")
        language = state.get("language", "en")

        # Build conversation history from messages
        messages = state.get("messages", [])
        conversation_history = ""
        for msg in messages[:-1]:  # Exclude the latest message
            role = "Rep" if hasattr(msg, "type") and msg.type == "ai" else "Retailer"
            conversation_history += f"{role}: {msg.content}\n"

        template_vars = {
            "store_name": account.get("store_name", "Store"),
            "owner_name": account.get("owner_name", "Owner ji"),
            "outstanding_amount": f"{account.get('outstanding_amount', 0):,.0f}",
            "days_overdue": account.get("days_overdue", 0),
            "credit_tier": account.get("credit_tier", "B"),
            "payment_history": account.get("payment_history", ""),
            "conversation_history": conversation_history or "This is the start of the conversation.",
            "latest_message": latest_message,
        }

        try:
            result = await self._rag.query(
                query_text=f"payment collection {latest_message}",
                collection=self._settings.QDRANT_COLLECTION_SALES_PLAYBOOKS,
                filters={},
                prompt_template=COLLECTION_CONVERSATION_PROMPT,
                template_vars=template_vars,
                top_k=2,
            )

            parsed = result.get("result", {})
            if not isinstance(parsed, dict):
                parsed = {"response_text": str(parsed)}

            response_text = parsed.get("response_text", "")
            intent_detected = parsed.get("intent_detected", "question")
            payment_amount = parsed.get("payment_promised_amount")
            payment_date = parsed.get("payment_promised_date")
            should_escalate = parsed.get("escalate", False)
            next_action = parsed.get("next_action", "")

            return {
                "response": response_text,
                "escalate": should_escalate,
                "structured_output": {
                    "intent": intent_detected,
                    "payment_promised_amount": payment_amount,
                    "payment_promised_date": payment_date,
                    "next_action": next_action,
                    "account": account,
                },
            }

        except Exception:
            logger.warning("Collection response generation failed.")
            # Fallback response
            outstanding = account.get("outstanding_amount", 0)
            owner = account.get("owner_name", "Sir/Madam")
            days = account.get("days_overdue", 0)

            if language == "hi":
                response = (
                    f"Namaste {owner} ji! "
                    f"Aapka INR {outstanding:,.0f} ka outstanding hai jo {days} din se pending hai. "
                    f"Kya aap payment kab tak kar sakte hain?"
                )
            else:
                response = (
                    f"Hello {owner}! "
                    f"You have an outstanding amount of INR {outstanding:,.0f} "
                    f"which has been pending for {days} days. "
                    f"When can we expect the payment?"
                )

            return {
                "response": response,
                "escalate": False,
                "structured_output": {
                    "intent": "initial_reminder",
                    "account": account,
                },
            }

    def _should_escalate(self, state: AgentState) -> str:
        """Check if the conversation should be escalated."""
        if state.get("escalate", False):
            return "escalate"
        return "continue"

    async def _process_outcome(self, state: AgentState) -> dict[str, Any]:
        """Process the conversation outcome (payment promise, etc.)."""
        structured = state.get("structured_output", {})
        intent = structured.get("intent", "")

        # In production, this would update the database with:
        # - Payment promise date and amount
        # - Next follow-up date
        # - Conversation log

        metadata = state.get("metadata", {})
        metadata["collection_outcome"] = {
            "intent": intent,
            "payment_promised_amount": structured.get("payment_promised_amount"),
            "payment_promised_date": structured.get("payment_promised_date"),
            "next_action": structured.get("next_action", ""),
        }

        return {"metadata": metadata}

    async def _escalate(self, state: AgentState) -> dict[str, Any]:
        """Handle escalation to a human agent."""
        language = state.get("language", "en")
        context = state.get("context", {})
        account = context.get("account", {})

        if language == "hi":
            response = (
                f"{state.get('response', '')}\n\n"
                f"[Note: Is case ko manager ko escalate kiya gaya hai. "
                f"Store: {account.get('store_name', 'Unknown')}, "
                f"Outstanding: INR {account.get('outstanding_amount', 0):,.0f}]"
            )
        else:
            response = (
                f"{state.get('response', '')}\n\n"
                f"[Note: This case has been escalated to the territory manager. "
                f"Store: {account.get('store_name', 'Unknown')}, "
                f"Outstanding: INR {account.get('outstanding_amount', 0):,.0f}]"
            )

        return {
            "response": response,
            "structured_output": {
                **state.get("structured_output", {}),
                "status": "escalated",
            },
        }
