
from app.agents.insights.graph import build_insights_graph
from app.agents.insights.schemas import InsightsAnswer, InsightItem
from tests.fakes import FakeLlm


FACTS = {
    "revenue": {
        "available": True,
        "current_period": 1000,
        "previous_period": 800,
        "change_percent": 25,
    },
    "categories": [],
    "top_products": [],
    "slow_movers": [],
}


async def test_graph_accepts_answer_using_known_numbers():
    def answer(user_text, system_text):
        return InsightsAnswer(
            summary="Revenue was ₹1,000 compared with ₹800 previously.",
            insights=[
                InsightItem(
                    title="Revenue",
                    observation="Revenue increased by 25%.",
                    recommendation="Continue monitoring sales.",
                )
            ],
        )

    graph = build_insights_graph(
        FakeLlm({InsightsAnswer: answer})
    )

    result = await graph.ainvoke({
        "mode": "dashboard",
        "period": "last30",
        "question": None,
        "facts": FACTS,
    })

    assert result["used_fallback"] is False
    assert result["answer"]["summary"].startswith("Revenue was")


async def test_graph_rejects_unverified_numeric_claim():
    def answer(user_text, system_text):
        return InsightsAnswer(
            summary="Revenue was ₹1,000 and profit was ₹700.",
            insights=[],
        )

    graph = build_insights_graph(
        FakeLlm({InsightsAnswer: answer})
    )

    result = await graph.ainvoke({
        "mode": "dashboard",
        "period": "last30",
        "question": None,
        "facts": FACTS,
    })

    # The current graph sends invalid answers to its existing fallback.
    # We are deliberately not changing or testing the fallback's content here.
    assert result["used_fallback"] is True

async def test_question_mode_uses_question_aware_fallback():
    graph = build_insights_graph(FakeLlm())  # No handler: simulates LLM failure.

    facts = {
        **FACTS,
        "top_products": [
            {"productName": "Biscuits", "revenue": 700},
        ],
    }

    result = await graph.ainvoke({
        "mode": "question",
        "period": "last30",
        "question": "Which products generated the most revenue?",
        "facts": facts,
    })

    assert result["used_fallback"] is True
    assert "Biscuits" in result["answer"]["summary"]


def test_graph_rejects_profit_claims():
    from app.agents.insights.graph import _answer_uses_supported_metrics

    answer = InsightsAnswer(
        summary="Revenue was ₹1,000 and profit was ₹500.",
        insights=[],
    )

    assert _answer_uses_supported_metrics(answer) is False