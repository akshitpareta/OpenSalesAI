"""
Sales coaching agent using LangGraph StateGraph.

Provides interactive coaching scenarios for sales representatives:
  1. Selects a scenario based on the rep's weakest KPIs.
  2. Role-plays a store owner with realistic objections.
  3. Evaluates the rep's responses.
  4. Generates feedback with scores.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langgraph.graph import END, StateGraph

from app.agents.state import AgentState
from app.core.config import get_settings
from app.rag.pipeline import RAGPipeline
from app.rag.prompts import COACH_SCENARIO_PROMPT

logger = logging.getLogger(__name__)

EVALUATION_PROMPT = """\
You are a sales coach evaluating a sales representative's response in a
role-play scenario for an Indian CPG/FMCG company.

## Scenario
{scenario_description}

## Store Owner Said
"{owner_dialogue}"

## Rep Responded
"{rep_response}"

## Skills Being Tested
{skills_tested}

## Evaluation Criteria
1. Product Knowledge (0-10): Did the rep demonstrate knowledge of the products?
2. Objection Handling (0-10): Did the rep address the store owner's concerns?
3. Relationship Building (0-10): Was the rep respectful and empathetic?
4. Closing Technique (0-10): Did the rep attempt to close or move the conversation forward?
5. Communication (0-10): Was the response clear, professional, and appropriate?

Respond ONLY with valid JSON:
{{
  "scores": {{
    "product_knowledge": 0-10,
    "objection_handling": 0-10,
    "relationship_building": 0-10,
    "closing_technique": 0-10,
    "communication": 0-10
  }},
  "overall_score": 0-100,
  "feedback": "string — specific, constructive feedback",
  "strengths": ["string", ...],
  "improvements": ["string", ...],
  "suggested_response": "string — how a top performer would have responded",
  "next_owner_dialogue": "string — what the store owner says next (continue role-play)"
}}
"""


class CoachAgent:
    """LangGraph agent for sales coaching role-play."""

    def __init__(self, rag_pipeline: RAGPipeline | None = None) -> None:
        self._rag = rag_pipeline or RAGPipeline()
        self._settings = get_settings()
        self._graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        graph = StateGraph(AgentState)

        graph.add_node("select_scenario", self._select_scenario)
        graph.add_node("evaluate_response", self._evaluate_response)
        graph.add_node("generate_feedback", self._generate_feedback)

        graph.set_entry_point("select_scenario")

        # If we have a scenario in context, evaluate; otherwise, generate new
        graph.add_conditional_edges(
            "select_scenario",
            self._has_active_scenario,
            {
                "new_scenario": "generate_feedback",  # Present the scenario
                "evaluate": "evaluate_response",       # Evaluate rep's response
            },
        )

        graph.add_edge("evaluate_response", "generate_feedback")
        graph.add_edge("generate_feedback", END)

        return graph

    async def process(self, state: AgentState) -> dict[str, Any]:
        compiled = self._graph.compile()
        result = await compiled.ainvoke(state)
        return {
            "response": result.get("response", ""),
            "structured_output": result.get("structured_output", {}),
            "scenario": result.get("scenario", {}),
            "score": result.get("score", 0),
            "feedback": result.get("feedback", ""),
            "metadata": result.get("metadata", {}),
        }

    def _has_active_scenario(self, state: AgentState) -> str:
        """Check if there's an active coaching scenario in context."""
        context = state.get("context", {})
        if context.get("active_scenario"):
            return "evaluate"
        return "new_scenario"

    async def _select_scenario(self, state: AgentState) -> dict[str, Any]:
        """Select or create a coaching scenario based on the rep's weak areas."""
        user_id = state.get("user_id", "")
        company_id = state.get("company_id", "")
        language = state.get("language", "en")
        context = state.get("context", {})

        # If there's an active scenario, pass it through
        if context.get("active_scenario"):
            return {"scenario": context["active_scenario"]}

        # Determine rep's weak areas (from context or defaults)
        weak_areas = context.get("weak_areas", "objection handling, upselling")
        coaching_focus = state.get("input", "general sales coaching")
        territory_name = context.get("territory_name", "Default Territory")
        rep_name = context.get("rep_name", "Sales Rep")
        skill_tier = context.get("skill_tier", "B")

        template_vars = {
            "rep_name": rep_name,
            "skill_tier": skill_tier,
            "weak_areas": weak_areas,
            "territory_name": territory_name,
            "coaching_focus": coaching_focus,
        }

        try:
            result = await self._rag.query(
                query_text=f"sales coaching scenario for {weak_areas}",
                collection=self._settings.QDRANT_COLLECTION_SALES_PLAYBOOKS,
                filters={"company_id": company_id} if company_id else None,
                prompt_template=COACH_SCENARIO_PROMPT,
                template_vars=template_vars,
                top_k=3,
            )

            scenario = result.get("result", {})
            if not isinstance(scenario, dict):
                scenario = self._default_scenario(weak_areas)

            return {"scenario": scenario}

        except Exception:
            logger.warning("Scenario generation failed, using default.")
            return {"scenario": self._default_scenario(weak_areas)}

    async def _evaluate_response(self, state: AgentState) -> dict[str, Any]:
        """Evaluate the rep's response in the role-play."""
        rep_response = state.get("input", "")
        scenario = state.get("scenario", {})
        context = state.get("context", {})

        if not scenario:
            scenario = context.get("active_scenario", {})

        scenario_desc = scenario.get("situation", "General sales scenario")
        owner_dialogue = scenario.get("opening_dialogue", context.get("last_owner_dialogue", ""))
        skills_tested = ", ".join(scenario.get("skills_tested", ["general sales"]))

        prompt = EVALUATION_PROMPT.format(
            scenario_description=scenario_desc,
            owner_dialogue=owner_dialogue,
            rep_response=rep_response,
            skills_tested=skills_tested,
        )

        try:
            raw_response = await self._rag.generate(prompt, temperature=0.2)
            evaluation = self._parse_evaluation(raw_response)

            return {
                "score": evaluation.get("overall_score", 50),
                "feedback": evaluation.get("feedback", "Good effort!"),
                "structured_output": evaluation,
                "metadata": {
                    **state.get("metadata", {}),
                    "evaluation": evaluation,
                },
            }
        except Exception:
            logger.warning("Evaluation failed.")
            return {
                "score": 50,
                "feedback": "Good effort! Keep practising.",
                "structured_output": {},
            }

    async def _generate_feedback(self, state: AgentState) -> dict[str, Any]:
        """Generate the final coaching response."""
        scenario = state.get("scenario", {})
        score = state.get("score", 0)
        feedback_text = state.get("feedback", "")
        language = state.get("language", "en")
        evaluation = state.get("structured_output", {})
        context = state.get("context", {})

        # If this is a new scenario (no evaluation yet), present the scenario
        if not context.get("active_scenario") and not evaluation:
            title = scenario.get("scenario_title", "Sales Scenario")
            situation = scenario.get("situation", "You walk into the store...")
            persona = scenario.get("store_owner_persona", {})
            opening = scenario.get("opening_dialogue", "")
            difficulty = scenario.get("difficulty", "medium")

            if language == "hi":
                response = (
                    f"**Coaching Scenario: {title}**\n"
                    f"Difficulty: {difficulty}\n\n"
                    f"**Situation:** {situation}\n\n"
                    f"**Store Owner ({persona.get('name', 'Owner')}):** "
                    f"\"{opening}\"\n\n"
                    f"Aap kya kahenge? Apna jawab type karein..."
                )
            else:
                response = (
                    f"**Coaching Scenario: {title}**\n"
                    f"Difficulty: {difficulty}\n\n"
                    f"**Situation:** {situation}\n\n"
                    f"**Store Owner ({persona.get('name', 'Owner')}):** "
                    f"\"{opening}\"\n\n"
                    f"How would you respond? Type your answer..."
                )

            return {
                "response": response,
                "structured_output": {"scenario": scenario, "status": "awaiting_response"},
            }

        # Present evaluation results
        scores = evaluation.get("scores", {})
        strengths = evaluation.get("strengths", [])
        improvements = evaluation.get("improvements", [])
        suggested = evaluation.get("suggested_response", "")
        next_dialogue = evaluation.get("next_owner_dialogue", "")

        score_lines = "\n".join(
            f"  - {k.replace('_', ' ').title()}: {v}/10"
            for k, v in scores.items()
        ) if scores else ""

        strength_lines = "\n".join(f"  + {s}" for s in strengths) if strengths else ""
        improve_lines = "\n".join(f"  - {i}" for i in improvements) if improvements else ""

        if language == "hi":
            response = (
                f"**Score: {score}/100**\n\n"
                f"**Feedback:** {feedback_text}\n\n"
            )
        else:
            response = (
                f"**Score: {score}/100**\n\n"
                f"**Feedback:** {feedback_text}\n\n"
            )

        if score_lines:
            response += f"**Scores:**\n{score_lines}\n\n"
        if strength_lines:
            response += f"**Strengths:**\n{strength_lines}\n\n"
        if improve_lines:
            response += f"**Areas to Improve:**\n{improve_lines}\n\n"
        if suggested:
            response += f"**Suggested Response:** \"{suggested}\"\n\n"
        if next_dialogue:
            response += f"**Store Owner:** \"{next_dialogue}\"\n\nContinue the conversation or type 'end' to finish."

        return {
            "response": response,
            "structured_output": {
                "status": "evaluated",
                "score": score,
                "scores": scores,
                "next_dialogue": next_dialogue,
            },
        }

    def _default_scenario(self, weak_areas: str) -> dict[str, Any]:
        """Generate a default scenario when LLM is unavailable."""
        return {
            "scenario_title": "The Reluctant Kirana Owner",
            "store_owner_persona": {
                "name": "Ramesh Ji",
                "personality": "Cautious, price-sensitive, loyal to existing brands",
                "store_type": "Kirana Store",
                "mood": "Neutral but busy",
                "main_objection": "Already stocking competitor products",
            },
            "situation": (
                "You visit a medium-sized kirana store in a busy market area. "
                "The owner, Ramesh Ji, has been a customer for 6 months but his "
                "order frequency has dropped from 4x/month to 1x/month. He seems "
                "to be stocking more competitor products."
            ),
            "opening_dialogue": (
                "Arey bhai, aaj kya laye ho? Main already bahut saman rakh liya hai "
                "aur jagah bhi nahi hai shelf mein."
            ),
            "success_criteria": [
                "Acknowledge the space constraint empathetically",
                "Highlight unique value proposition vs competitors",
                "Offer a trial or small order to rebuild the habit",
                "Mention any applicable promotions",
            ],
            "difficulty": "medium",
            "skills_tested": weak_areas.split(", ") if isinstance(weak_areas, str) else ["general"],
        }

    @staticmethod
    def _parse_evaluation(raw: str) -> dict[str, Any]:
        """Parse the LLM's evaluation response."""
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        import re

        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        return {
            "overall_score": 50,
            "feedback": raw[:500] if raw else "Good effort!",
            "scores": {},
            "strengths": [],
            "improvements": [],
        }
