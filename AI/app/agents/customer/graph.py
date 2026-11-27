"""The customer-query flow as a LangGraph graph.

    understand -> (product question?) -> lookup -> compose -> done
                        \\-> compose (greeting, other, nothing to look up)

The Inventory Agent retrieves product facts from Node.
The Customer Agent only replies using those facts.
"""

import json
import time
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel

from app.agents.customer.faq import FAQAnswer, find_faq
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


class Reply(BaseModel):
    reply: str


class CustomerState(TypedDict, total=False):
    # Input
    faq: FAQAnswer | None
    business_id: str
    message: str
    shop_name: str | None

    # Intermediate state
    understanding: Understanding
    items: list[AvailabilityItem]
    llm_failed: bool

    # Output
    reply: str
    language: str
    used_fallback: bool


def build_customer_graph(llm: LlmClient, node: NodeClient):

    async def understand(state: CustomerState) -> CustomerState:
        try:
            understanding = await llm.generate(
                system=UNDERSTAND_SYSTEM,
                user=state["message"],
                schema=Understanding,
            )
            return {
                "understanding": understanding,
                "llm_failed": False,
            }

        except LlmError:
            return {
                "understanding": fallback_understanding(state["message"]),
                "llm_failed": True,
            }

    def route_after_understand(state: CustomerState) -> str:
        understanding = state["understanding"]

        if understanding.intent == "product_query" and understanding.mentions:
            return "lookup"

        if understanding.intent == "faq_query":
            return "faq_lookup"

        return "compose"

    async def lookup(state: CustomerState) -> CustomerState:
        items = await find_availability(
            state["business_id"],
            state["understanding"].mentions,
            node=node,
            llm=llm,
        )

        return {"items": items}

    async def faq_lookup(state: CustomerState) -> CustomerState:
        understanding = state["understanding"]

        faq = await find_faq(
            state["business_id"],
            state["message"],
            understanding.language,
            node=node,
        )

        return {"faq": faq}

    async def compose(state: CustomerState) -> CustomerState:
        understanding = state["understanding"]
        language = templates.language_or_default(understanding.language)
        items = state.get("items") or []

        if understanding.intent == "faq_query":
            faq = state.get("faq")

            if faq:
                return {
                    "reply": faq.answer,
                    "language": language,
                    "used_fallback": False,
                }

            return {
                "reply": templates.faq_no_match_reply(language),
                "language": language,
                "used_fallback": True,
            }

        if understanding.intent == "greeting":
            return {
                "reply": templates.greeting_reply(language),
                "language": language,
                "used_fallback": False,
            }

        if understanding.intent == "other" or not understanding.mentions:
            return {
                "reply": templates.other_reply(language),
                "language": language,
                "used_fallback": False,
            }

        if not items:
            return {
                "reply": templates.no_match_reply(language),
                "language": language,
                "used_fallback": False,
            }

        facts = [item.as_fact() for item in items]

        try:
            drafted = await llm.generate(
                system=COMPOSE_SYSTEM,
                user=json.dumps(
                    {
                        "facts": facts,
                        "language": language,
                        "shop_name": state.get("shop_name"),
                    },
                    ensure_ascii=False,
                ),
                schema=Reply,
                temperature=0.2,
            )

            draft = drafted.reply.strip()
            validation_problems = check_reply(draft, facts, language)

            # IMPORTANT:
            # An empty problem list means the reply is valid.
            # Any validation problem means we must use the fixed template.
            if not validation_problems:
                return {
                    "reply": draft,
                    "language": language,
                    "used_fallback": False,
                }

        except LlmError:
            pass

        # The model failed or its reply contained an unsupported claim.
        return {
            "reply": templates.availability_reply(facts, language),
            "language": language,
            "used_fallback": True,
        }

    graph = StateGraph(CustomerState)
    graph.add_node("faq_lookup", faq_lookup)
    graph.add_node("understand", understand)
    graph.add_node("lookup", lookup)
    graph.add_node("compose", compose)

    graph.add_edge(START, "understand")

    graph.add_conditional_edges(
        "understand",
        route_after_understand,
        ["lookup", "faq_lookup", "compose"],
    )
    graph.add_edge("faq_lookup", "compose")
    graph.add_edge("lookup", "compose")
    graph.add_edge("compose", END)

    return graph.compile()


async def answer_customer(
    graph,
    *,
    business_id: str,
    message: str,
    shop_name: str | None,
) -> dict:
    """Run one customer query and return reply, language and matched count."""
    started = time.perf_counter()

    state = await graph.ainvoke(
        {
            "business_id": business_id,
            "message": message,
            "shop_name": shop_name,
        }
    )

    matched = len(state.get("items") or [])

    # Metadata only: never log the customer's message, product words or reply.
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

    return {
        "reply": state["reply"],
        "language": state["language"],
        "matched_count": matched,
    }