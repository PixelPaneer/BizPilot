
"""A plain-code reading of a message, used when the model cannot be reached
or gives no usable answer.
"""

import re

from app.agents.customer.schemas import Mention, Understanding

_GREETINGS = {
    "hi", "hii", "hiii", "hello", "hey", "heyy", "namaste",
    "namaskar", "good morning", "good afternoon", "good evening",
    "नमस्ते", "नमस्कार", "हेलो", "हैलो", "हाय",
}

_FILLER = {
    "is", "are", "the", "a", "an", "do", "you", "have", "has",
    "any", "available", "availability", "out", "stock", "in",
    "price", "prices", "rate", "cost", "of", "for", "me",
    "please", "pls", "plz", "tell", "what", "whats", "how",
    "much", "kitna", "kitne", "kitni", "ka", "ki", "ke",
    "hai", "hain", "hain?", "kya", "kaise", "mein", "nahi",
    "he", "h", "bhai", "bhaiya", "sir", "mil", "jayega",
    "milega", "chahiye", "dena", "dijiye", "hoga", "to",
    "aur", "or", "and",
    "उपलब्ध", "है", "हैं", "क्या", "का", "की", "के",
    "कीमत", "दाम", "रेट", "में", "मिलेगा", "चाहिए",
    "कितना", "कितने", "भैया",
}

_HINGLISH_MARKERS = {
    "hai", "hain", "kya", "kitna", "kitne", "kitni",
    "ka", "ki", "ke", "mein", "nahi", "chahiye",
    "milega", "mil", "bhai", "bhaiya", "dena", "aur",
}

_DEVANAGARI = re.compile(r"[\u0900-\u097F]")

_FAQ_MARKERS = {
    "return", "refund", "delivery", "shipping", "payment",
    "upi", "cash", "card", "timing", "timings", "opening",
    "closing", "address", "location", "contact", "policy",
    "exchange", "discount", "offer", "offers", "parking",
    "hours", "open", "close",
    "वापसी", "रिफंड", "डिलीवरी", "भुगतान", "पता",
    "समय", "खुला", "बंद",
}


def _words(message: str) -> list[str]:
    return re.findall(r"[\w\u0900-\u097F']+", message.lower())


def detect_language(message: str) -> str:
    if _DEVANAGARI.search(message):
        return "hindi"

    if _HINGLISH_MARKERS.intersection(_words(message)):
        return "hinglish"

    return "english"


def fallback_understanding(message: str) -> Understanding:
    language = detect_language(message)
    words = _words(message)

    if " ".join(words) in _GREETINGS:
        return Understanding(
            intent="greeting",
            mentions=[],
            language=language,
        )

    if _FAQ_MARKERS.intersection(words):
        return Understanding(
            intent="faq_query",
            mentions=[],
            language=language,
        )

    name_words = [word for word in words if word not in _FILLER]
    name = " ".join(name_words).strip()

    if len(re.sub(r"[\W_]+", "", name)) < 2:
        return Understanding(
            intent="other",
            mentions=[],
            language=language,
        )

    return Understanding(
        intent="product_query",
        mentions=[Mention(text=name, latin_text=name)],
        language=language,
    )
