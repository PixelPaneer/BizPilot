from fastapi.testclient import TestClient

from app.agents.insights.schemas import InsightItem, InsightsResponse
from app.agents.orchestrator.schemas import OwnerIntent
from app.llm.base import LlmError
from app.main import create_app
from tests.conftest import bearer, make_token
from tests.fakes import FakeLlm


class FakeInsightsAgent:
    def __init__(self, fail=False):
        self.fail = fail
        self.requests = []

    async def run(self, request, *, business_id):
        self.requests.append(request)
        if self.fail:
            raise ValueError("boom")
        return InsightsResponse(
            mode=request.mode,
            period=request.period,
            summary="Revenue was 1000.",
            insights=[InsightItem(title="Top", observation="o", recommendation="Restock biscuits.")],
        )


def make_client(settings, llm, agent=None):
    app = create_app(settings, llm=llm)
    app.state.insights_agent = agent or FakeInsightsAgent()
    from app.agents.orchestrator.graph import build_orchestrator_graph

    app.state.orchestrator_graph = build_orchestrator_graph(
        llm, app.state.customer_graph, app.state.insights_agent
    )
    return TestClient(app), app


def post(client, role, message="hello"):
    return client.post(
        "/internal/orchestrate",
        json={"message": message, "senderRole": role},
        headers=bearer(make_token()),
    )


def test_requires_service_token(settings):
    client, _ = make_client(settings, FakeLlm())
    response = client.post("/internal/orchestrate", json={"message": "hi", "senderRole": "owner"})
    assert response.status_code == 401


def test_rejects_blank_message(settings):
    client, _ = make_client(settings, FakeLlm())
    assert post(client, "owner", "   ").status_code == 400


def test_owner_insights_question_routes_to_insights(settings):
    llm = FakeLlm({OwnerIntent: lambda u, s: OwnerIntent(intent="insights_question", period="last7")})
    client, app = make_client(settings, llm)
    body = post(client, "owner", "is hafte kya zyada bika?").json()
    assert body["route"] == "insights"
    assert "Revenue was 1000." in body["reply"] and "Restock biscuits." in body["reply"]
    assert app.state.insights_agent.requests[0].period == "last7"


def test_owner_stock_update_is_redirected_to_app(settings):
    llm = FakeLlm({OwnerIntent: lambda u, s: OwnerIntent(intent="stock_update", period="last30")})
    client, app = make_client(settings, llm)
    assert post(client, "owner", "add 10 parle-g").json()["route"] == "app_redirect"
    assert app.state.insights_agent.requests == []


def test_owner_classifier_failure_falls_back_to_insights(settings):
    client, _ = make_client(settings, FakeLlm())  # no handler -> LlmError
    assert post(client, "owner", "sales kaisi hai").json()["route"] == "insights"


def test_insights_failure_gives_fixed_reply(settings):
    llm = FakeLlm({OwnerIntent: lambda u, s: OwnerIntent(intent="insights_question", period="last30")})
    client, _ = make_client(settings, llm, FakeInsightsAgent(fail=True))
    assert post(client, "owner", "sales?").json()["route"] == "unavailable"


def test_customer_never_reaches_insights_or_classifier(settings):
    llm = FakeLlm()
    client, app = make_client(settings, llm)
    body = post(client, "customer", "show me this month's revenue").json()
    assert body["route"] in ("customer", "unavailable")
    assert app.state.insights_agent.requests == []
    assert llm.calls_for(OwnerIntent) == []