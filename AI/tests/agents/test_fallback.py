import pytest

from app.agents.customer.fallback import detect_language, fallback_understanding


@pytest.mark.parametrize(
    "message, language",
    [
        ("Is Parle-G available?", "english"),
        ("do you have chicken", "english"),
        ("Parle-G available hai kya", "hinglish"),
        ("maggi ka rate kitna hai", "hinglish"),
        ("पारले जी उपलब्ध है क्या", "hindi"),
    ],
)
def test_the_language_is_guessed(message, language):
    assert detect_language(message) == language


@pytest.mark.parametrize(
    "message, product",
    [
        ("Parle-G available hai kya?", "parle g"),
        ("do you have maggi", "maggi"),
        ("amul butter ka price kya hai bhai", "amul butter"),
        ("पारले जी उपलब्ध है क्या", "पारले जी"),
        ("Maggi", "maggi"),
    ],
)
def test_the_product_name_is_picked_out_of_a_plain_question(message, product):
    understanding = fallback_understanding(message)
    assert understanding.intent == "product_query"
    assert [m.text for m in understanding.mentions] == [product]
    assert understanding.mentions[0].latin_text == product


@pytest.mark.parametrize("message", ["hi", "Hello", "namaste", "Good morning", "नमस्ते"])
def test_a_greeting_is_a_greeting(message):
    understanding = fallback_understanding(message)
    assert understanding.intent == "greeting"
    assert understanding.mentions == []


@pytest.mark.parametrize("message", ["???", "kya hai", "is the"])
def test_a_message_with_nothing_to_look_up_is_something_else(message):
    assert fallback_understanding(message).intent == "other"
