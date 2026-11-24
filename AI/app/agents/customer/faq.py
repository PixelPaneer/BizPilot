"""Retrieve approved business FAQs from the Node backend."""

from dataclasses import dataclass
import math

from app.tools.node_client import NodeClient


@dataclass
class FAQAnswer:
    faq_id: str
    question: str
    answer: str
    language: str
    similarity: float


def _faq_language(language: str) -> str:
    """Convert the Customer Agent language into the FAQ database language code."""
    return {
        "english": "en",
        "hindi": "hi",
        "hinglish": "hinglish",
    }.get(language, "en")


def _safe_similarity(value) -> float:
    """Convert similarity into a valid finite float."""
    try:
        score = float(value)
        return score if math.isfinite(score) else 0.0
    except (TypeError, ValueError, OverflowError):
        return 0.0


async def find_faq(
    business_id: str,
    question: str,
    language: str,
    *,
    node: NodeClient,
) -> FAQAnswer | None:
    """Return the most relevant active FAQ for this business, if one exists."""

    data = await node.get(
        business_id,
        "/internal/faqs/search",
        {
            "q": question.strip(),
            "language": _faq_language(language),
            "limit": 5,
        },
    )

    if not isinstance(data, dict):
        return None

    faqs = data.get("faqs", [])
    if not isinstance(faqs, list):
        return None

    # Backend returns results ordered by relevance, highest first.
    for raw in faqs:
        if not isinstance(raw, dict):
            continue

        question_text = raw.get("question")
        answer_text = raw.get("answer")

        if not isinstance(question_text, str) or not question_text.strip():
            continue

        if not isinstance(answer_text, str) or not answer_text.strip():
            continue

        return FAQAnswer(
            faq_id=str(raw.get("faqId", "")),
            question=question_text.strip(),
            answer=answer_text.strip(),
            language=str(raw.get("language", "")),
            similarity=_safe_similarity(raw.get("similarity", 0)),
        )

    return None