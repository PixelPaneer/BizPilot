import pytest

from app.shared import reply_templates as t


def test_the_hinglish_example_from_the_spec():
    facts = [
        {"name": "Parle-G", "price": 5, "status": "available"},
        {"name": "Parle-G", "price": 10, "status": "limited"},
    ]
    assert t.availability_reply(facts, "hinglish") == "Parle-G (₹5) available hai, Parle-G (₹10) kam stock hai."


def test_english_and_hindi_wording():
    facts = [{"name": "Maggi", "price": 14, "status": "out"}]
    assert t.availability_reply(facts, "english") == "Maggi (₹14): out of stock."
    assert t.availability_reply(facts, "hindi") == "Maggi (₹14) स्टॉक में नहीं है."
    facts = [{"name": "Maggi", "price": 14, "status": "available"}]
    assert t.availability_reply(facts, "english") == "Maggi (₹14) is available."


def test_prices_are_formatted_with_the_rupee_sign():
    assert t.format_price(10) == "₹10"
    assert t.format_price(10.0) == "₹10"
    assert t.format_price(10.5) == "₹10.50"
    assert t.format_price(1250) == "₹1250"


@pytest.mark.parametrize("language", ["english", "hindi", "hinglish"])
def test_every_fixed_reply_exists_in_every_language(language):
    for text in (t.greeting_reply(language), t.other_reply(language), t.no_match_reply(language)):
        assert text.strip()


def test_an_unknown_language_falls_back_to_english():
    assert t.greeting_reply("klingon") == t.greeting_reply("english")
    assert t.language_or_default(None) == "english"
