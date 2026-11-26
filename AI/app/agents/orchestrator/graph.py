"""LangGraph router. Customers always go to the Customer flow; the role is never chosen by the model.
Only owner messages are classified, and only into read-only routes."""

import time
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.customer.graph import answer_customer
from app.agents.insights.schemas import InsightsRequest
from app.agents.orchestrator.formatting import (
    APP_REDIRECT_REPLY,
    UNAVAILABLE_REPLY,
    format_insights_reply,
)
from app.agents.orchestrator.prompts import OWNER_INTENT_SYSTEM
from app.agents.orchestrator.schemas import OwnerIntent
from app.llm.base import LlmClient, LlmError
from app.shared.logging import log_event


class OrchestratorState(TypedDict, total=False):
    business_id: str
    message: str
    sender_role: str
    shop_name: str | None
    intent: str
    period: str
    reply: str
    route: str
    language: str | None


def build_orchestrator_graph(llm: LlmClient, customer_graph, insights_agent):
    async def classify(state: OrchestratorState) -> OrchestratorState:
        if state["sender_role"] == "customer":
            return {"intent": "customer"}
        try:
            owner = await llm.generate(
                system=OWNER_INTENT_SYSTEM,
                user=state["message"],
                schema=OwnerIntent,
                temperature=0.0,
            )
            return {"intent": owner.intent, "period": owner.period}
        except LlmError:
            # Read-only and safe: the Insights Agent has its own fallback.
            return {"intent": "insights_question", "period": "last30"}

    def pick_route(state: OrchestratorState) -> str:
        return {"customer": "customer", "insights_question": "insights"}.get(
            state["intent"], "app_redirect"
        )

    async def customer(state: OrchestratorState) -> OrchestratorState:
        try:
            result = await answer_customer(
                customer_graph,
                business_id=state["business_id"],
                message=state["message"],
                shop_name=state.get("shop_name"),
            )
        except Exception:  # noqa: BLE001 - never echo the error: it may hold the customer's words
            return {"route": "unavailable", "reply": UNAVAILABLE_REPLY}
        return {"route": "customer", "reply": result["reply"], "language": result["language"]}

    async def insights(state: OrchestratorState) -> OrchestratorState:
        try:
            request = InsightsRequest(
                mode="question",
                period=state.get("period", "last30"),
                question=state["message"][:500],
            )
            result = await insights_agent.run(request, business_id=state["business_id"])
        except Exception:  # noqa: BLE001
            return {"route": "unavailable", "reply": UNAVAILABLE_REPLY}
        return {"route": "insights", "reply": format_insights_reply(result)}

    async def app_redirect(state: OrchestratorState) -> OrchestratorState:
        return {"route": "app_redirect", "reply": APP_REDIRECT_REPLY}

    graph = StateGraph(OrchestratorState)
    graph.add_node("classify", classify)
    graph.add_node("customer", customer)
    graph.add_node("insights", insights)
    graph.add_node("app_redirect", app_redirect)
    graph.add_edge(START, "classify")
    graph.add_conditional_edges(
        "classify",
        pick_route,
        {"customer": "customer", "insights": "insights", "app_redirect": "app_redirect"},
    )
    for node in ("customer", "insights", "app_redirect"):
        graph.add_edge(node, END)
    return graph.compile()


async def orchestrate(graph, *, business_id: str, message: str, sender_role: str, shop_name: str | None) -> dict:
    """Runs one message through the router and returns { reply, route, language }."""
    started = time.perf_counter()
    state = await graph.ainvoke(
        {
            "business_id": business_id,
            "message": message,
            "sender_role": sender_role,
            "shop_name": shop_name,
        }
    )
    # Metadata only: never the message or the reply.
    log_event(
        "orchestrate",
        flow="orchestrator",
        sender_role=sender_role,
        route=state["route"],
        duration_ms=round((time.perf_counter() - started) * 1000),
    )
    return {"reply": state["reply"], "route": state["route"], "language": state.get("language")}