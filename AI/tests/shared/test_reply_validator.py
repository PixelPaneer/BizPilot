import pytest

from app.shared.reply_templates import STATUS_WORDS, availability_reply
from app.shared.reply_validator import check_reply

FACTS = [
    {"name": "Parle-G", "price": 5, "status": "available"},
    {"name": "Parle-G Gold", "price": 10.5, "status": "limited"},
]


@pytest.mark.parametrize("language", ["english", "hindi", "hinglish"])
@pytest.mark.parametrize("status", ["available", "limited", "out"])
def test_the_fixed_templates_always_pass(language, status):
    facts = [{"name": "Maggi 70g", "price": 14, "status": status}]
    assert check_reply(availability_reply(facts, language), facts, language) == []


@pytest.mark.parametrize("language", ["english", "hindi", "hinglish"])
def test_templates_with_mixed_statuses_pass(language):
    facts = FACTS + [{"name": "Parle Monaco", "price": 20, "status": "out"}]
    assert check_reply(availability_reply(facts, language), facts, language) == []


def test_a_natural_reply_that_uses_only_the_facts_passes():
    reply = "Parle-G (₹5) is available, and Parle-G Gold (₹10.50) has limited stock. 🙂"
    assert check_reply(reply, FACTS, "english") == []


def test_digits_that_belong_to_a_product_name_are_allowed():
    facts = [{"name": "Parle-G 50g", "price": 5, "status": "available"}]
    assert check_reply("Parle-G 50g (₹5) is available.", facts, "english") == []


def test_the_price_is_accepted_however_it_is_written():
    facts = [{"name": "Atta", "price": 1250, "status": "available"}]
    assert check_reply("Atta (₹1,250) is available.", facts, "english") == []
    assert check_reply("Atta (₹1250.00) is available.", facts, "english") == []


@pytest.mark.parametrize(
    "reply, why",
    [
        ("Parle-G (₹6) is available, Parle-G Gold (₹10.50) has limited stock.", "wrong price"),
        ("Parle-G (₹5) is available, Parle-G Gold (₹10.50) has limited stock, 3 left.", "a quantity"),
        ("Parle-G (₹5) is available.", "a product is left out"),
        ("Parle-G (₹5) is out of stock, Parle-G Gold (₹10.50) has limited stock.", "says out of stock but nothing is"),
        ("Parle-G (₹5) is available, Parle-G Gold (₹10.50) is available.", "limited product shown as available"),
        ("Parle-G (₹5) is available, Parle-G Gold (₹10.50) has limited stock. Cost price is ₹3.", "cost"),
        ("Parle-G (₹5) is available, Parle-G Gold (₹10.50) has limited stock. Margin is high.", "margin"),
        ("", "empty"),
        ("Parle-G (₹5) is available, Parle-G Gold (₹10.50) has limited stock. " + "x" * 600, "too long"),
    ],
)
def test_a_reply_that_adds_or_changes_something_is_refused(reply, why):
    assert check_reply(reply, FACTS, "english"), why


def test_a_status_that_is_in_the_facts_but_not_in_the_reply_is_refused():
    facts = [{"name": "Maggi", "price": 14, "status": "out"}]
    assert check_reply("Maggi (₹14).", facts, "english")


@pytest.mark.parametrize("language", ["hindi", "hinglish"])
def test_other_languages_are_checked_too(language):
    words = STATUS_WORDS[language]
    good = f"Parle-G (₹5) {words['available']}, Parle-G Gold (₹10.50) {words['limited']}."
    assert check_reply(good, FACTS, language) == []
    bad = f"Parle-G (₹7) {words['available']}, Parle-G Gold (₹10.50) {words['limited']}."
    assert check_reply(bad, FACTS, language)
