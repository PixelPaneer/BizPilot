
from app.agents.insights.calculations import build_insights_facts


def test_builds_revenue_totals_and_change_percentage():
    facts = build_insights_facts(
        category_data={"categories": []},
        top_data={"products": []},
        revenue_data={
            "daily": [
                {
                    "period": "1 Nov",
                    "selectedPeriodRevenue": 600,
                    "previousPeriodRevenue": 400,
                },
                {
                    "period": "2 Nov",
                    "selectedPeriodRevenue": 400,
                    "previousPeriodRevenue": 400,
                },
            ]
        },
        slow_data={"products": []},
    )

    assert facts["revenue"]["available"] is True
    assert facts["revenue"]["current_period"] == 1000
    assert facts["revenue"]["previous_period"] == 800
    assert facts["revenue"]["change_percent"] == 25


def test_zero_previous_revenue_has_no_percentage():
    facts = build_insights_facts(
        category_data={},
        top_data={},
        revenue_data={
            "daily": [
                {
                    "period": "1 Nov",
                    "selectedPeriodRevenue": 500,
                    "previousPeriodRevenue": 0,
                }
            ]
        },
        slow_data={},
    )

    assert facts["revenue"]["available"] is True
    assert facts["revenue"]["current_period"] == 500
    assert facts["revenue"]["previous_period"] == 0
    assert facts["revenue"]["change_percent"] is None


def test_missing_daily_revenue_is_unavailable():
    facts = build_insights_facts(
        category_data={},
        top_data={},
        revenue_data={},
        slow_data={},
    )

    assert facts["revenue"]["available"] is False
    assert facts["revenue"]["current_period"] is None
    assert facts["revenue"]["previous_period"] is None


def test_invalid_or_non_finite_revenue_is_not_used():
    facts = build_insights_facts(
        category_data={},
        top_data={},
        revenue_data={
            "daily": [
                {
                    "period": "1 Nov",
                    "selectedPeriodRevenue": float("nan"),
                    "previousPeriodRevenue": 100,
                }
            ]
        },
        slow_data={},
    )

    assert facts["revenue"]["available"] is False


def test_other_analytics_data_is_preserved():
    categories = [{"category": "Snacks", "revenue": 1000}]
    top_products = [{"productName": "Biscuits", "revenue": 700}]
    slow_products = [{"productName": "Juice", "unitsSold": 0}]

    facts = build_insights_facts(
        category_data={"categories": categories},
        top_data={"products": top_products},
        revenue_data={"daily": []},
        slow_data={"products": slow_products},
    )

    assert facts["categories"] == categories
    assert facts["top_products"] == top_products
    assert facts["slow_movers"] == slow_products

def test_question_fallback_answers_top_products():
    from app.agents.insights.calculations import deterministic_fallback

    facts = {
        "revenue": {"available": False},
        "categories": [],
        "top_products": [
            {"productName": "Biscuits", "revenue": 700},
            {"productName": "Juice", "revenue": 500},
        ],
        "slow_movers": [],
    }

    result = deterministic_fallback(
        facts, "last30", mode="question",
        question="Which products generated the most revenue?",
    )

    assert "Biscuits" in result["summary"]
    assert "Juice" in result["summary"]
    assert result["insights"] == []


def test_question_fallback_does_not_invent_missing_revenue():
    from app.agents.insights.calculations import deterministic_fallback

    result = deterministic_fallback(
        {"revenue": {"available": False}, "categories": [],
         "top_products": [], "slow_movers": []},
        "last30",
        mode="question",
        question="What was my revenue?",
    )

    assert "unavailable" in result["summary"].lower()