"""The message of a customer must never reach a log (or leave for any service but the model)."""

import logging

import respx
from fastapi.testclient import TestClient

from app.agents.customer.graph import Reply
from app.agents.customer.schemas import Mention, Understanding
from app.main import create_app
from tests.conftest import bearer, make_token
from tests.fakes import NODE, FakeCatalog, FakeLlm

CANARY = "CANARY-7f3a9c-do-not-log"

PRODUCTS = [{"productId": "p-5", "name": "Parle-G", "price": 5, "status": "available"}]


def logged_text(caplog) -> str:
    return "\n".join(record.getMessage() for record in caplog.records)


@respx.mock
def test_the_message_never_appears_in_logs_output_or_calls_to_node(settings, caplog, capsys):
    understanding = Understanding(
        intent="product_query",
        language="english",
        mentions=[Mention(text="parle g", latin_text="parle g")],
    )
    llm = FakeLlm(
        {
            Understanding: lambda user, system: understanding,
            Reply: lambda user, system: Reply(reply="Parle-G (₹5) is available."),
        }
    )
    catalog = FakeCatalog(PRODUCTS)
    respx.get(f"{NODE}/internal/catalog/search").mock(side_effect=catalog)
    client = TestClient(create_app(settings, llm=llm))

    message = f"parle g available hai kya {CANARY}"
    with caplog.at_level(logging.DEBUG):
        response = client.post(
            "/internal/customer-query",
            headers=bearer(make_token()),
            json={"message": message, "shopName": f"Shop {CANARY}"},
        )

    assert response.status_code == 200
    printed = capsys.readouterr()
    assert CANARY not in logged_text(caplog)
    assert CANARY not in printed.out and CANARY not in printed.err
    assert CANARY not in response.text
    assert all(CANARY not in str(request.url) for request in catalog.requests), (
        "the whole message is never sent to Node"
    )
    # create_app sends the service's logging to stdout, so that is where its log lines are
    assert "customer_query" in printed.out, "the request itself was logged, as metadata"


@respx.mock
def test_a_failing_request_does_not_log_the_message_either(settings, caplog, capsys):
    llm = FakeLlm()  # fails every call
    respx.get(f"{NODE}/internal/catalog/search").mock(side_effect=FakeCatalog(PRODUCTS))
    client = TestClient(create_app(settings, llm=llm))

    with caplog.at_level(logging.DEBUG):
        client.post(
            "/internal/customer-query",
            headers=bearer(make_token()),
            json={"message": f"parle g {CANARY}"},
        )

    printed = capsys.readouterr()
    assert CANARY not in logged_text(caplog)
    assert CANARY not in printed.out and CANARY not in printed.err
    assert "customer_query" in printed.out
