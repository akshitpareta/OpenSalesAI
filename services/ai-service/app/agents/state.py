"""
Shared agent state definitions for the LangGraph multi-agent system.

All agents in the system share a common ``AgentState`` TypedDict that flows
through the LangGraph StateGraph. The state includes conversation history,
user context, tool outputs, and routing metadata.
"""

from __future__ import annotations

from typing import Any, Literal, TypedDict

from langchain_core.messages import BaseMessage
from pydantic import BaseModel, Field


class AgentState(TypedDict, total=False):
    """Shared state flowing through all LangGraph agent nodes.

    This TypedDict is used as the state schema for every StateGraph in the
    system. Nodes read from and write to this dict.
    """

    # ── Session ───────────────────────────────────────────────────────
    session_id: str
    user_type: str  # "rep", "retailer", "manager", "system"
    user_id: str
    company_id: str
    language: str  # "en", "hi", "hinglish"

    # ── Conversation ──────────────────────────────────────────────────
    messages: list[BaseMessage]
    input: str  # Latest user input

    # ── Context ───────────────────────────────────────────────────────
    context: dict[str, Any]  # Retrieved RAG context, user profile, etc.
    tools_output: dict[str, Any]  # Output from tool calls

    # ── Routing ───────────────────────────────────────────────────────
    current_intent: str  # Detected intent label
    confidence: float  # Intent detection confidence
    target_agent: str  # Agent to route to
    escalate: bool  # Whether to escalate to human
    error: str | None  # Error message if any

    # ── Agent-specific ────────────────────────────────────────────────
    order_items: list[dict[str, Any]]  # Parsed order line items
    matched_products: list[dict[str, Any]]  # Catalog-matched products
    inventory_status: list[dict[str, Any]]  # Inventory check results
    sql_query: str  # Generated SQL for analytics
    sql_result: list[dict[str, Any]]  # Query result rows
    scenario: dict[str, Any]  # Coaching scenario data
    score: float  # Coaching score
    feedback: str  # Coaching feedback

    # ── Output ────────────────────────────────────────────────────────
    response: str  # Final response text to send to the user
    structured_output: dict[str, Any]  # Structured JSON output
    metadata: dict[str, Any]  # Additional metadata


# ── Intent Constants ─────────────────────────────────────────────────────────

class Intent:
    """Known intent labels for routing."""

    ORDER = "order"
    ORDER_STATUS = "order_status"
    COACHING = "coaching"
    ANALYTICS = "analytics"
    COLLECTION = "collection"
    PROMOTION = "promotion"
    GENERAL = "general"
    GREETING = "greeting"
    UNKNOWN = "unknown"

    ALL = [
        ORDER, ORDER_STATUS, COACHING, ANALYTICS,
        COLLECTION, PROMOTION, GENERAL, GREETING, UNKNOWN,
    ]


# ── Pydantic Models for Structured Agent I/O ────────────────────────────────

class ChatRequest(BaseModel):
    """Incoming chat request from the API layer."""

    session_id: str
    user_type: str = "rep"
    user_id: str
    company_id: str = ""
    message: str
    language: str = "en"
    context: dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    """Outgoing chat response from the agent system."""

    session_id: str
    response: str
    intent: str = Intent.UNKNOWN
    confidence: float = 0.0
    structured_output: dict[str, Any] = Field(default_factory=dict)
    agent_used: str = ""
    escalated: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)
