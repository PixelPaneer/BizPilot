"""The Inventory Agent's availability lookup: from what a customer wrote to the shop's products.

It asks Node's customer-safe search for candidates (never the database), keeps the ones that really
match, and, only when nothing matches well, asks the language model to pick among a few names. Prices
and statuses always come from Node, never from the model.
"""

import json
import re

from app.agents.customer.schemas import Mention
from app.agents.inventory.prompts import DISAMBIGUATE_SYSTEM
from app.agents.inventory.schemas import AvailabilityItem, Choice
from app.llm.base import LlmClient, LlmError
from app.tools.node_client import NodeClient

# A candidate at least this similar to what the customer wrote counts as a match by itself.
HIGH_SIMILARITY = 0.6
MAX_MENTIONS = 3
MAX_PER_MENTION = 5
MAX_ITEMS = 8
MAX_CANDIDATES_FOR_MODEL = 5


def _worth_searching(text: str) -> bool:
    """Node refuses search text with fewer than two letters or digits."""
    return len(re.sub(r"[\W_]+", "", text)) >= 2


def _squash(text: str) -> str:
    """'Parle-G 50 g' -> 'parleg50g': for comparing sizes regardless of spaces and punctuation."""
    return re.sub(r"[\W_]+", "", text.lower())


async def _candidates(node: NodeClient, business_id: str, mention: Mention) -> list[AvailabilityItem]:
    queries = [mention.latin_text]
    if mention.text.strip().lower() != mention.latin_text.strip().lower():
        queries.append(mention.text)  # a name written in its own script can be found directly

    found: dict[str, AvailabilityItem] = {}
    for query in queries:
        if not _worth_searching(query):
            continue
        data = await node.get(business_id, "/internal/catalog/search", {"q": query.strip(), "limit": 5})
        for raw in data["items"]:
            item = AvailabilityItem.from_node(raw)
            known = found.get(item.product_id)
            if known is None or item.similarity > known.similarity:
                found[item.product_id] = item
    return sorted(found.values(), key=lambda item: (-item.similarity, item.name))


async def _ask_model_to_choose(
    llm: LlmClient, mention: Mention, candidates: list[AvailabilityItem]
) -> list[AvailabilityItem]:
    shortlist = candidates[:MAX_CANDIDATES_FOR_MODEL]
    payload = {
        "customer_wrote": mention.text,
        "candidates": [{"id": item.product_id, "name": item.name} for item in shortlist],
    }
    try:
        choice = await llm.generate(
            system=DISAMBIGUATE_SYSTEM,
            user=json.dumps(payload, ensure_ascii=False),
            schema=Choice,
        )
    except LlmError:
        return []  # not sure, so say nothing rather than guess

    wanted = set(choice.product_ids)  # ids the model invented are simply not in the shortlist
    return [item for item in shortlist if item.product_id in wanted]


def _narrow(items: list[AvailabilityItem], mention: Mention) -> list[AvailabilityItem]:
    """If the customer named a price or a size, keep only the products that fit it, when any do."""
    if mention.price_hint is not None:
        fitting = [item for item in items if abs(item.price - mention.price_hint) < 0.005]
        if fitting:
            items = fitting
    if mention.size_or_unit and _squash(mention.size_or_unit):
        size = _squash(mention.size_or_unit)
        fitting = [item for item in items if size in _squash(item.name)]
        if fitting:
            items = fitting
    return items


async def find_availability(
    business_id: str,
    mentions: list[Mention],
    *,
    node: NodeClient,
    llm: LlmClient,
) -> list[AvailabilityItem]:
    """The shop's products that match what the customer named, each with price and status."""
    result: dict[str, AvailabilityItem] = {}

    for mention in mentions[:MAX_MENTIONS]:
        candidates = await _candidates(node, business_id, mention)
        if not candidates:
            continue

        strong = [item for item in candidates if item.similarity >= HIGH_SIMILARITY]
        selected = strong or await _ask_model_to_choose(llm, mention, candidates)

        for item in _narrow(selected, mention)[:MAX_PER_MENTION]:
            result.setdefault(item.product_id, item)

    return list(result.values())[:MAX_ITEMS]
