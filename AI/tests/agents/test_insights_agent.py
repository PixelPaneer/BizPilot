import json

from app.agents.insights.agent import InsightsAgent
from app.agents.insights.schemas import (
    InsightsAnswer,
    InsightsRequest,
    InsightItem,
)
from tests.fakes import FakeLlm


BUSINESS_ID = "ced5c1db-c94c-4d39-a458-36e17f57e53d"


class FakeNode:
    def __init__(self):
        self.calls = []

        self.responses = {
            "/internal/analytics/category-sales": {
                "categories": [
                    {
                        "category": "Snacks",
                        "revenue": 1000,
                        "unitsSold": 20,
                        "revenuePercentage": 100,
                        "unitsPercentage": 100,
                    }
                ]
            },
            "/internal/analytics/top-products": {
                "products": [
                    {
                        "productName": "Biscuits",
                        "category": "Snacks",
                        "unitsSold": 20,
                        "revenue": 1000,
                    }
                ]
            },
            "/internal/analytics/revenue-analysis": {
                "daily": [
                    {
                        "period": "1 Nov",
                        "selectedPeriodRevenue": 1000,
                        "previousPeriodRevenue": 800,
                    }
                ]
            },
            "/internal/analytics/slow-movers": {
                "products": [
                    {
                        "productName": "Juice",
                        "category": "Drinks",
                        "unitsSold": 0,
                        "revenue": 0,
                        "currentStock": 10,
                    }
                ]
            },
        }

    async def get(self, business_id, path, params=None):
        self.calls.append({
            "business_id": business_id,
            "path": path,
            "params": params,
        })
        return self.responses[path]


def make_llm(expected_period="last30"):
    def answer(user_text, system_text):
        payload = json.loads(user_text)
        assert payload["mode"] == "dashboard"
        assert payload["period"] == expected_period

        return InsightsAnswer(
            summary="Revenue was ₹1,000 compared with ₹800 previously.",
            insights=[
                InsightItem(
                    title="Top product",
                    observation="Biscuits generated ₹1,000 revenue.",
                    recommendation="Review its stock regularly.",
                )
            ],
        )

    return FakeLlm({InsightsAnswer: answer})


async def test_agent_fetches_all_four_analytics_sources():
    node = FakeNode()
    llm = make_llm()
    agent = InsightsAgent(llm, node)

    request = InsightsRequest(
        mode="dashboard",
        period="last30",
    )

    response = await agent.run(
        request,
        business_id=BUSINESS_ID,
    )

    paths = {call["path"] for call in node.calls}

    assert paths == {
        "/internal/analytics/category-sales",
        "/internal/analytics/top-products",
        "/internal/analytics/revenue-analysis",
        "/internal/analytics/slow-movers",
    }

    assert all(call["business_id"] == BUSINESS_ID for call in node.calls)
    assert response.mode == "dashboard"
    assert response.period == "last30"
    assert response.used_fallback is False
    assert response.summary.startswith("Revenue was")
    assert len(response.insights) == 1


async def test_agent_passes_selected_period_to_node():
    node = FakeNode()
    agent = InsightsAgent(make_llm(expected_period="last7"), node)

    request = InsightsRequest(
        mode="dashboard",
        period="last7",
    )

    await agent.run(request, business_id=BUSINESS_ID)

    assert all(
        call["params"]["period"] == "last7"
        for call in node.calls
    )
