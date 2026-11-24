"""Fixed, fill-in-the-blank replies in English, Hindi and Hinglish.

Used when the model is down, when its reply fails the check against the facts, and for the cases
that need no model at all (a greeting, an unrelated question, no match). Every price and status in
them comes straight from the facts.
"""

from typing import Literal

Language = Literal["english", "hindi", "hinglish"]
Status = Literal["available", "limited", "out"]

# How each status is worded. The reply validator uses the same words to check a model's reply.
STATUS_WORDS: dict[str, dict[str, str]] = {
    "english": {"available": "available", "limited": "limited stock", "out": "out of stock"},
    "hindi": {"available": "उपलब्ध है", "limited": "कम स्टॉक है", "out": "स्टॉक में नहीं है"},
    "hinglish": {"available": "available hai", "limited": "kam stock hai", "out": "stock mein nahi hai"},
}

_GREETING = {
    "english": "Hello! Which product would you like to check? I can tell you whether it is available and its price.",
    "hindi": "नमस्ते! आप कौन सा प्रोडक्ट देखना चाहते हैं? मैं बता सकता हूँ कि वह उपलब्ध है या नहीं और उसकी कीमत क्या है।",
    "hinglish": "Namaste! Aap kaun sa product check karna chahte hain? Main bata sakta hoon ki available hai ya nahi aur uska price kya hai.",
}

_OTHER = {
    "english": "Sorry, I can only answer questions about whether a product is available and its price.",
    "hindi": "माफ़ कीजिए, मैं केवल यह बता सकता हूँ कि कोई प्रोडक्ट उपलब्ध है या नहीं और उसकी कीमत क्या है।",
    "hinglish": "Sorry, main sirf yeh bata sakta hoon ki koi product available hai ya nahi aur uska price kya hai.",
}

_NO_MATCH = {
    "english": "Sorry, I could not find that in our catalog. Please ask the shop directly.",
    "hindi": "माफ़ कीजिए, यह हमारे कैटलॉग में नहीं मिला। कृपया दुकान से सीधे पूछ लें।",
    "hinglish": "Sorry, yeh hamare catalog mein nahi mila. Please shop se seedha pooch lijiye.",
}


def language_or_default(language: str | None) -> str:
    return language if language in STATUS_WORDS else "english"


def format_price(price: float) -> str:
    """10 -> '10', 10.5 -> '10.50'. Always the rupee sign in front."""
    return f"₹{int(price)}" if float(price).is_integer() else f"₹{price:.2f}"


def fact_line(name: str, price: float, status: str, language: str) -> str:
    language = language_or_default(language)
    phrase = STATUS_WORDS[language][status]
    if language == "english":
        return f"{name} ({format_price(price)}) is {phrase}" if status == "available" else f"{name} ({format_price(price)}): {phrase}"
    return f"{name} ({format_price(price)}) {phrase}"


def availability_reply(facts: list[dict], language: str) -> str:
    """One short sentence listing every matching product with its price and status."""
    return ", ".join(fact_line(f["name"], f["price"], f["status"], language) for f in facts) + "."


def greeting_reply(language: str) -> str:
    return _GREETING[language_or_default(language)]


def other_reply(language: str) -> str:
    return _OTHER[language_or_default(language)]


def no_match_reply(language: str) -> str:
    return _NO_MATCH[language_or_default(language)]
