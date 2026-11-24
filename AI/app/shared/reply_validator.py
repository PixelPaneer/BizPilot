
"""Checks a drafted reply against the facts it was written from.

The model writes the wording; it must not add anything. A reply passes only if:
  - every number in it is a price from the facts (or a digit that is part of a product name),
  - every product in the facts is named,
  - every product occurrence has its own correct price and availability status,
  - the stock words it uses match the statuses in the facts,
  - it does not talk about cost, margins or quantities.

When validation fails, the caller uses fixed templates based on the facts.
"""

import re
from decimal import Decimal, InvalidOperation

from app.shared.reply_templates import STATUS_WORDS

MAX_REPLY_LENGTH = 500

_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")

_FORBIDDEN = re.compile(
    r"\b(cost price|purchase price|buying price|wholesale|margin|profit|"
    r"units? left|pieces? left|in stock:?\s*\d)\b",
    re.IGNORECASE,
)

_STATUS_PATTERNS = {
    "out": re.compile(
        r"out of stock|not available|unavailable|stock mein nahi|"
        r"available nahi|स्टॉक में नहीं|उपलब्ध नहीं",
        re.IGNORECASE,
    ),
    "limited": re.compile(
        r"limited stock|few left|running low|kam stock|कम स्टॉक",
        re.IGNORECASE,
    ),
    "available": re.compile(
        r"(?<!not )(?<!un)\bavailable\b(?! nahi)|उपलब्ध है",
        re.IGNORECASE,
    ),
}


def _normalise_number(value: str) -> str | None:
    try:
        return str(Decimal(value.replace(",", "")).normalize())
    except InvalidOperation:
        return None


def _numbers_in(text: str) -> set[str]:
    return {
        value
        for value in (
            _normalise_number(match)
            for match in _NUMBER.findall(text)
        )
        if value is not None
    }


def _normalise_name(name: str) -> str:
    return re.sub(r"[\W_]+", " ", name.lower()).strip()


def _find_occurrences(
    reply: str,
    facts: list[dict],
) -> list[tuple[int, int, str]]:
    """Find every product-name occurrence, including repeated names.

    Longer names take precedence when product names overlap.
    """
    unique_names = {
        fact["name"].strip()
        for fact in facts
        if fact["name"].strip()
    }

    candidates = []

    for name in unique_names:
        pattern = re.compile(re.escape(name), re.IGNORECASE)

        for match in pattern.finditer(reply):
            candidates.append((match.start(), match.end(), name))

    candidates.sort(
        key=lambda item: (-(item[1] - item[0]), item[0])
    )

    accepted = []

    for candidate in candidates:
        start, end, _name = candidate

        overlaps = any(
            start < existing_end and end > existing_start
            for existing_start, existing_end, _ in accepted
        )

        if not overlaps:
            accepted.append(candidate)

    return sorted(accepted, key=lambda item: item[0])


def _fact_matches_segment(fact: dict, segment: str) -> bool:
    """Check whether one reply segment states this fact's price and status."""
    expected_price = _normalise_number(str(fact["price"]))

    if not expected_price:
        return False

    if expected_price not in _numbers_in(segment):
        return False

    status = fact["status"]

    if status not in _STATUS_PATTERNS:
        return False

    if not _STATUS_PATTERNS[status].search(segment):
        return False

    # A segment must not claim a different availability status too.
    for other_status, pattern in _STATUS_PATTERNS.items():
        if other_status != status and pattern.search(segment):
            return False

    return True


def check_reply(reply: str, facts: list[dict], language: str) -> list[str]:
    """Return validation problems. An empty list means the reply is acceptable."""
    problems: list[str] = []
    text = reply.strip()

    if not text:
        return ["empty reply"]

    if not facts:
        return ["no product facts"]

    if len(text) > MAX_REPLY_LENGTH:
        problems.append("reply too long")

    # Preserve the original restriction on cost, margins and quantities.
    if _FORBIDDEN.search(text):
        problems.append("mentions cost, margin or quantity")

    # Every product occurrence must have its own correct price and status.
    occurrences = _find_occurrences(text, facts)

    if len(occurrences) != len(facts):
        problems.append("one or more product occurrences are missing or extra")

    segments = []

    for index, (start, end, name) in enumerate(occurrences):
        next_start = (
            occurrences[index + 1][0]
            if index + 1 < len(occurrences)
            else len(text)
        )

        segments.append((name, text[start:next_start]))

    # Match each occurrence to one unused fact. This supports duplicate
    # catalogue names with different prices or statuses.
    unused_facts = list(facts)

    for name, segment in segments:
        matching_name = [
            fact for fact in unused_facts
            if _normalise_name(fact["name"]) == _normalise_name(name)
        ]

        matching_fact = next(
            (
                fact for fact in matching_name
                if _fact_matches_segment(fact, segment)
            ),
            None,
        )

        if matching_fact is None:
            problems.append(
                f"wrong price or availability status for {name}"
            )
            continue

        unused_facts.remove(matching_fact)

    if unused_facts:
        problems.append("one or more catalogue facts were not represented")

    # Only catalogue prices and digits belonging to product names are allowed.
    allowed_numbers = set()

    for fact in facts:
        price = _normalise_number(str(fact["price"]))

        if price:
            allowed_numbers.add(price)

        allowed_numbers |= _numbers_in(fact["name"])

    extra_numbers = _numbers_in(text) - allowed_numbers

    if extra_numbers:
        problems.append(
            f"numbers not in the facts: {sorted(extra_numbers)}"
        )

    # Preserve the original global checks against unsupported stock claims.
    statuses = {fact["status"] for fact in facts}

    for status, pattern in _STATUS_PATTERNS.items():
        if status not in statuses and pattern.search(text):
            problems.append(
                f"claims {status} without a fact for it"
            )

    # Preserve the original requirement that every status in the facts
    # must be expressed in the reply.
    words = STATUS_WORDS.get(language, STATUS_WORDS["english"])

    for status in statuses:
        pattern = _STATUS_PATTERNS.get(status)

        if pattern is None:
            problems.append(f"unknown status in facts: {status}")
            continue

        if not pattern.search(text) and words[status].lower() not in text.lower():
            problems.append(f"status not stated: {status}")

    return problems
