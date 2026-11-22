"""The customer-query flow as a LangGraph graph.

    understand -> (product question?) -> lookup -> compose -> done
                        \\-> compose (greeting, other, nothing to look up)

- understand: the model reads the message (intent, product names in Latin letters, language). If the
  model fails, a plain-code reading is used instead.
- lookup: the Inventory Agent finds the matching products through Node (name, price, status only).
- compose: writes the reply from those facts only. The model's wording is checked against the facts;
  if it fails the check, or the model is down, a fixed template is used.

The graph holds no memory between requests: nothing about a message is kept.
"""

import json
import time
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.customer.fallback import fallback_understanding
from app.agents.customer.prompts import COMPOSE_SYSTEM, UNDERSTAND_SYSTEM
from app.agents.customer.schemas import Understanding
from app.agents.inventory.availability import find_availability
from app.agents.inventory.schemas import AvailabilityItem
from app.llm.base import LlmClient, LlmError
from app.shared import reply_templates as templates
from app.shared.logging import log_event
from app.shared.reply_validator import check_reply
from app.tools.node_client import NodeClient
from pydantic import BaseModel


class Reply(BaseModel):
    reply: str


class CustomerState(TypedDict, total=False):
    # input
    business_id: str
    message: str
    shop_name: str | None
    # in between
    understanding: Understanding
    items: list[AvailabilityItem]
    llm_failed: bool
    # output
    reply: str
    language: str
    used_fallback: bool


def build_customer_graph(llm: LlmClient, node: NodeClient):
    async def understand(state: CustomerState) -> CustomerState:
        try:
            understanding = await llm.generate(
                system=UNDERSTAND_SYSTEM, user=state["message"], schema=Understanding
            )
            return {"understanding": understanding, "llm_failed": False}
        except LlmError:
            return {"understanding": fallback_understanding(state["message"]), "llm_failed": True}

    def route_after_understand(state: CustomerState) -> str:
        understanding = state["understanding"]
        if understanding.intent == "product_query" and understanding.mentions:
            return "lookup"
        return "compose"

    async def lookup(state: CustomerState) -> CustomerState:
        items = await find_availability(
            state["business_id"], state["understanding"].mentions, node=node, llm=llm
        )
        return {"items": items}

    async def compose(state: CustomerState) -> CustomerState:
        understanding = state["understanding"]
        language = templates.language_or_default(understanding.language)
        items = state.get("items") or []

        if understanding.intent == "greeting":
            return {"reply": templates.greeting_reply(language), "language": language, "used_fallback": False}
        if understanding.intent == "other" or not understanding.mentions:
            return {"reply": templates.other_reply(language), "language": language, "used_fallback": False}
        if not items:
            return {"reply": templates.no_match_reply(language), "language": language, "used_fallback": False}

        facts = [item.as_fact() for item in items]
        try:
            drafted = await llm.generate(
                system=COMPOSE_SYSTEM,
                user=json.dumps(
                    {"facts": facts, "language": language, "shop_name": state.get("shop_name")},
                    ensure_ascii=False,
                ),
                schema=Reply,
                temperature=0.2,
            )
            if not check_reply(drafted.reply, facts, language):
                return {"reply": drafted.reply.strip(), "language": language, "used_fallback": False}
        except LlmError:
            pass

        # the model was down, or its wording added something that is not in the facts
        return {"reply": templates.availability_reply(facts, language), "language": language, "used_fallback": True}

    graph = StateGraph(CustomerState)
    graph.add_node("understand", understand)
    graph.add_node("lookup", lookup)
    graph.add_node("compose", compose)
    graph.add_edge(START, "understand")
    graph.add_conditional_edges("understand", route_after_understand, ["lookup", "compose"])
    graph.add_edge("lookup", "compose")
    graph.add_edge("compose", END)
    return graph.compile()


async def answer_customer(graph, *, business_id: str, message: str, shop_name: str | None) -> dict:
    """Runs the flow for one message and returns { reply, language, matched_count }."""
    started = time.perf_counter()
    state = await graph.ainvoke(
        {"business_id": business_id, "message": message, "shop_name": shop_name}
    )
    matched = len(state.get("items") or [])

    # Metadata only: never the message, the product words or the reply.
    log_event(
        "customer_query",
        flow="customer",
        intent=state["understanding"].intent,
        language=state["language"],
        matched_count=matched,
        used_fallback=state["used_fallback"],
        llm_failed=state["llm_failed"],
        duration_ms=round((time.perf_counter() - started) * 1000),
    )
    return {"reply": state["reply"], "language": state["language"], "matched_count": matched}
