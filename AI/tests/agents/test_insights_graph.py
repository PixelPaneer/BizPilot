
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
