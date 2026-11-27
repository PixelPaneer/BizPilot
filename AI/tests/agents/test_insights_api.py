
import json

import respx
from fastapi.testclient import TestClient
from httpx import Response

from app.agents.insights.schemas import InsightsAnswer, InsightItem
from app.main import create_app
from tests.conftest import BUSINESS_ID, bearer, make_token
from tests.fakes import FakeLlm


def make_llm():
    def answer(user_text, system_text):
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


def node_response(data):
    return Response(
        200,
        json={"success": True, "data": data},
    )


def test_insights_api_requires_service_authentication(settings):
    app = create_app(settings, llm=make_llm())

    with TestClient(app) as client:
        response = client.post(
            "/internal/insights/ask",
            json={"mode": "dashboard", "period": "last30"},
        )

    assert response.status_code == 401


def test_insights_api_rejects_question_mode_without_question(settings):
    app = create_app(settings, llm=make_llm())

    with TestClient(app) as client:
        response = client.post(
            "/internal/insights/ask",
            headers=bearer(make_token()),
            json={"mode": "question", "period": "last30"},
        )

    assert response.status_code == 400


@respx.mock
def test_insights_api_calls_node_and_returns_insights(settings):
    app = create_app(settings, llm=make_llm())

    base = "http://node.test"

    respx.get(f"{base}/internal/analytics/category-sales").mock(
        return_value=node_response({
            "categories": [
                {
                    "category": "Snacks",
                    "revenue": 1000,
                    "unitsSold": 20,
                    "revenuePercentage": 100,
                    "unitsPercentage": 100,
                }
            ]
        })
    )

    respx.get(f"{base}/internal/analytics/top-products").mock(
        return_value=node_response({
            "products": [
                {
                    "productName": "Biscuits",
                    "category": "Snacks",
                    "unitsSold": 20,
                    "revenue": 1000,
                }
            ]
        })
    )

    respx.get(f"{base}/internal/analytics/revenue-analysis").mock(
        return_value=node_response({
            "daily": [
                {
                    "period": "1 Nov",
                    "selectedPeriodRevenue": 1000,
                    "previousPeriodRevenue": 800,
                }
            ]
        })
    )

    respx.get(f"{base}/internal/analytics/slow-movers").mock(
        return_value=node_response({
            "products": [
                {
                    "productName": "Juice",
                    "category": "Drinks",
                    "unitsSold": 0,
                    "revenue": 0,
                    "currentStock": 10,
                }
            ]
        })
    )

    with TestClient(app) as client:
        response = client.post(
            "/internal/insights/ask",
            headers=bearer(make_token()),
            json={
                "mode": "dashboard",
                "period": "last30",
            },
        )

    assert response.status_code == 200

    body = response.json()

    assert body["mode"] == "dashboard"
    assert body["period"] == "last30"
    assert body["used_fallback"] is False
    assert "Revenue was" in body["summary"]
    assert len(body["insights"]) == 1

    assert respx.calls.call_count == 4
