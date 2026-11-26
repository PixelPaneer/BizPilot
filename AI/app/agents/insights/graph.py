"""LangGraph explanation stage. Business data retrieval happens in the agent/tool layer."""

import json
import re
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.insights.calculations import deterministic_fallback
from app.agents.insights.prompts import INSIGHTS_SYSTEM
from app.agents.insights.schemas import InsightsAnswer
from app.llm.base import LlmClient, LlmError


class InsightsState(TypedDict, total=False):
    mode: str
    period: str
    question: str | None
    facts: dict
    answer: dict
    used_fallback: bool


_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")


def _normalise_number(value: str) -> str:
    value = value.replace(",", "")
    if "." in value:
        value = value.rstrip("0").rstrip(".")
    return value


def _numbers_in(value: str) -> set[str]:
    return {_normalise_number(match) for match in _NUMBER.findall(value)}


def _answer_uses_only_known_numbers(
    answer: InsightsAnswer,
    facts: dict
) -> bool:

    allowed = _numbers_in(json.dumps(facts, ensure_ascii=False))

    answer_text = " ".join(
        [answer.summary]
        + [
            part
            for item in answer.insights
            for part in (
                item.title,
                item.observation,
                item.recommendation
            )
        ]
    )

    answer_numbers = _numbers_in(answer_text)

    if not answer_numbers.issubset(allowed):
        return False

    revenue = facts.get("revenue", {})

    if not revenue.get("available", True):
        if _numbers_in(answer.summary):
            return False

    return True

_UNSUPPORTED_METRIC_TERMS = re.compile(
    r"\b(profit|profitability|margin|gross margin|net margin)\b",
    re.IGNORECASE,
)


def _answer_uses_supported_metrics(answer: InsightsAnswer) -> bool:
    text = " ".join(
        [answer.summary]
        + [
            part
            for item in answer.insights
            for part in (item.title, item.observation, item.recommendation)
        ]
    )
    return not _UNSUPPORTED_METRIC_TERMS.search(text)


def build_insights_graph(llm: LlmClient):
    async def explain(state: InsightsState) -> InsightsState:
        prompt_data = {
            "mode": state["mode"],
            "period": state["period"],
            "question": state.get("question"),
            "metrics": state["facts"],
        }

        try:
            drafted = await llm.generate(
                system=INSIGHTS_SYSTEM,
                user=json.dumps(prompt_data, ensure_ascii=False),
                schema=InsightsAnswer,
                temperature=0.1,
            )
            if (
                _answer_uses_only_known_numbers(drafted, state["facts"])
                and _answer_uses_supported_metrics(drafted)
                ):
                return {
                    "answer": drafted.model_dump(),
                    "used_fallback": False,
                }
        except LlmError:
            pass

        fallback = deterministic_fallback(
            state["facts"],
            state["period"],
            mode=state["mode"],
            question=state.get("question"),
            )
        return {"answer": fallback, "used_fallback": True}

    graph = StateGraph(InsightsState)
    graph.add_node("explain", explain)
    graph.add_edge(START, "explain")
    graph.add_edge("explain", END)
    return graph.compile()
