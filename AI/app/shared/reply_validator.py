"""Checks a drafted reply against the facts it was written from.

The model writes the wording; it must not add anything. A reply passes only if:
  - every number in it is a price from the facts (or a digit that is part of a product name),
  - every product in the facts is named,
  - the stock words it uses match the statuses in the facts (it cannot say "out of stock" about a
    product that is available, or the other way round),
  - it does not talk about cost, margins or quantities.

This is a safety net, not a proof: a reply that passes can still be clumsy. When it fails, the caller
uses the fixed templates, which cannot contain anything but the facts.
"""

import re
from decimal import Decimal, InvalidOperation

from app.shared.reply_templates import STATUS_WORDS

MAX_REPLY_LENGTH = 500

_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")

# Words that must never appear: what the shop paid, its margin, how many are in stock.
_FORBIDDEN = re.compile(
    r"\b(cost price|purchase price|buying price|wholesale|margin|profit|"
    r"units? left|pieces? left|in stock:? \d)\b",
    re.IGNORECASE,
)

# Phrases that claim a status, in any of the three languages.
_OUT_CLAIM = re.compile(
    r"out of stock|not available|unavailable|stock mein nahi|available nahi|स्टॉक में नहीं|उपलब्ध नहीं",
    re.IGNORECASE,
)
_LIMITED_CLAIM = re.compile(
    r"limited stock|few left|running low|kam stock|कम स्टॉक", re.IGNORECASE
)
_AVAILABLE_CLAIM = re.compile(r"(?<!not )(?<!un)\bavailable\b(?! nahi)|उपलब्ध है", re.IGNORECASE)


def _normalise_number(text: str) -> str | None:
    try:
        return str(Decimal(text.replace(",", "")).normalize())
    except InvalidOperation:
        return None


def _numbers_in(text: str) -> set[str]:
    return {n for n in (_normalise_number(m) for m in _NUMBER.findall(text)) if n is not None}


def _flat(text: str) -> str:
    return re.sub(r"[\W_]+", " ", text.lower()).strip()


def check_reply(reply: str, facts: list[dict], language: str) -> list[str]:
    """Returns the problems found (an empty list means the reply is acceptable)."""
    problems: list[str] = []
    text = reply.strip()

    if not text:
        return ["empty reply"]
    if len(text) > MAX_REPLY_LENGTH:
        problems.append("reply too long")

    # numbers: only prices from the facts, and digits that belong to product names
    allowed: set[str] = set()
    for fact in facts:
        price = _normalise_number(str(fact["price"]))
        if price:
            allowed.add(price)
        allowed |= _numbers_in(fact["name"])
    extra = _numbers_in(text) - allowed
    if extra:
        problems.append(f"numbers not in the facts: {sorted(extra)}")

    # every product in the facts is named
    flat_reply = _flat(text)
    for fact in facts:
        if _flat(fact["name"]) not in flat_reply:
            problems.append(f"product missing: {fact['name']}")

    statuses = {fact["status"] for fact in facts}
    if "out" not in statuses and _OUT_CLAIM.search(text):
        problems.append("claims out of stock without a fact for it")
    if "limited" not in statuses and _LIMITED_CLAIM.search(text):
        problems.append("claims limited stock without a fact for it")
    if "available" not in statuses and _AVAILABLE_CLAIM.search(text):
        problems.append("claims available without a fact for it")

    # a status in the facts that the reply does not state at all
    words = STATUS_WORDS.get(language, STATUS_WORDS["english"])
    claims = {"out": _OUT_CLAIM, "limited": _LIMITED_CLAIM, "available": _AVAILABLE_CLAIM}
    for status in statuses:
        if not claims[status].search(text) and words[status].lower() not in text.lower():
            problems.append(f"status not stated: {status}")

    if _FORBIDDEN.search(text):
        problems.append("mentions cost, margin or quantity")

    return problems
