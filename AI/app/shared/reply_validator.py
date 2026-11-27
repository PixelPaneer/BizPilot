
"""Validate AI-generated customer replies against catalogue facts.

Each occurrence of a product must be associated with a valid catalogue
price and availability status. Repeated product names are supported.
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


def _find_occurrences(reply: str, facts: list[dict]) -> list[tuple[int, int, str]]:
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

    # Prefer longer names, then earlier positions.
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

    segment_numbers = _numbers_in(segment)

    if expected_price not in segment_numbers:
        return False

    if fact["status"] not in _STATUS_PATTERNS:
        return False

    expected_pattern = _STATUS_PATTERNS[fact["status"]]

    if not expected_pattern.search(segment):
        return False

    # A segment must not claim a different availability status too.
    for status, pattern in _STATUS_PATTERNS.items():
        if status != fact["status"] and pattern.search(segment):
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

    if _FORBIDDEN.search(text):
        problems.append("mentions cost, margin or quantity")

    occurrences = _find_occurrences(text, facts)

    if len(occurrences) != len(facts):
        problems.append("one or more product occurrences are missing or extra")

    # Build a segment around each product occurrence.
    segments = []

    for index, (start, end, name) in enumerate(occurrences):
        next_start = (
            occurrences[index + 1][0]
            if index + 1 < len(occurrences)
            else len(text)
        )

        segments.append((name, text[start:next_start]))

    # Match each occurrence to one unused fact. This allows two catalogue
    # products with the same display name but different prices/statuses.
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

    statuses = {fact["status"] for fact in facts}

    for status, pattern in _STATUS_PATTERNS.items():
        if status not in statuses and pattern.search(text):
            problems.append(f"claims {status} without a fact for it")

    words = STATUS_WORDS.get(language, STATUS_WORDS["english"])

    for status in statuses:
        pattern = _STATUS_PATTERNS.get(status)
        if pattern is None:
            problems.append(f"unknown status in facts: {status}")
        elif not pattern.search(text) and words[status].lower() not in text.lower():
            problems.append(f"status not stated: {status}")

    return problems
