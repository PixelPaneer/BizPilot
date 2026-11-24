
import httpx
import jwt
import pytest
import respx
from fastapi.testclient import TestClient

from app.agents.customer.schemas import Mention, Understanding
from app.main import create_app
from tests.conftest import BUSINESS_ID, SECRET, bearer, make_token
from tests.fakes import NODE, FakeCatalog, FakeLlm

PRODUCTS = [
    {
        "productId": "p-5",
        "name": "Parle-G",
        "price": 5,
        "status": "available",
    }
]


def understands(intent="faq_query", language="english", mentions=()):
    result = Understanding(
        intent=intent,
        language=language,
        mentions=list(mentions),
    )
    return lambda user, system: result


FAQ_RESPONSE = {
    "faqs": [
        {
            "faqId": "faq-101",
            "question": "What are your shop timings?",
            "answer": "Our shop is open from 9 AM to 9 PM.",
            "language": "en",
            "similarity": 0.95,
        }
    ]
}


def make_client(settings, llm):
    return TestClient(create_app(settings, llm=llm))


# TEST 1: FAQ query returns the backend answer
@respx.mock
def test_faq_query_returns_approved_backend_answer(settings):
    llm = FakeLlm({
        Understanding: understands()
    })

    faq_route = respx.get(
        f"{NODE}/internal/faqs/search"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": FAQ_RESPONSE,
            },
        )
    )

    catalog_route = respx.get(
        f"{NODE}/internal/catalog/search"
    ).mock(
        side_effect=FakeCatalog(PRODUCTS)
    )

    client = make_client(settings, llm)

    response = client.post(
        "/internal/customer-query",
        headers=bearer(make_token()),
        json={
            "message": "What are your shop timings?"
        },
    )

    assert response.status_code == 200

    assert response.json() == {
        "reply": "Our shop is open from 9 AM to 9 PM.",
        "language": "english",
        "matchedCount": 0,
    }

    assert faq_route.called
    assert not catalog_route.called

    assert len(llm.calls_for(Understanding)) == 1


# TEST 2: FAQ search uses the correct query parameters
@respx.mock
def test_faq_query_sends_correct_backend_parameters(settings):
    llm = FakeLlm({
        Understanding: understands()
    })

    route = respx.get(
        f"{NODE}/internal/faqs/search"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": FAQ_RESPONSE,
            },
        )
    )

    client = make_client(settings, llm)

    client.post(
        "/internal/customer-query",
        headers=bearer(make_token()),
        json={
            "message": "What are your shop timings?"
        },
    )

    request = route.calls.last.request

    assert request.url.params["q"] == "What are your shop timings?"
    assert request.url.params["language"] == "en"
    assert request.url.params["limit"] == "5"


# TEST 3: FAQ no-match uses the fixed fallback
@respx.mock
@pytest.mark.parametrize(
    ("language", "expected"),
    [
        (
            "english",
            "Sorry, I don't have an approved answer for that question. Please contact the shop directly.",
        ),
        (
            "hindi",
            "माफ़ कीजिए, इस सवाल का स्वीकृत जवाब मेरे पास नहीं है। कृपया दुकान से सीधे संपर्क करें।",
        ),
        (
            "hinglish",
            "Sorry, is question ka approved answer mere paas nahi hai. Please shop se directly contact karein.",
        ),
    ],
)
def test_faq_no_match_uses_fixed_fallback(
    settings,
    language,
    expected,
):
    llm = FakeLlm({
        Understanding: understands(language=language)
    })

    respx.get(
        f"{NODE}/internal/faqs/search"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"faqs": []},
            },
        )
    )

    client = make_client(settings, llm)

    response = client.post(
        "/internal/customer-query",
        headers=bearer(make_token()),
        json={
            "message": "Tell me something about your shop."
        },
    )

    assert response.status_code == 200
    assert response.json()["reply"] == expected
    assert response.json()["language"] == language
    assert response.json()["matchedCount"] == 0


# TEST 4: Product queries must not call FAQ lookup
@respx.mock
def test_product_query_does_not_call_faq_lookup(settings):
    mention = Mention(
        text="Parle-G",
        latin_text="parle g",
    )

    llm = FakeLlm({
        Understanding: understands(
            intent="product_query",
            mentions=[mention],
        )
    })

    faq_route = respx.get(
        f"{NODE}/internal/faqs/search"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"faqs": []},
            },
        )
    )

    catalog_route = respx.get(
        f"{NODE}/internal/catalog/search"
    ).mock(
        side_effect=FakeCatalog(PRODUCTS)
    )

    client = make_client(settings, llm)

    response = client.post(
        "/internal/customer-query",
        headers=bearer(make_token()),
        json={
            "message": "Is Parle-G available?"
        },
    )

    assert response.status_code == 200
    assert response.json()["matchedCount"] == 1

    assert catalog_route.called
    assert not faq_route.called


# TEST 5: Unrelated/order-related questions must not call FAQ or catalog
@respx.mock
def test_other_intent_does_not_call_faq_or_catalog(settings):
    llm = FakeLlm({
        Understanding: understands(intent="other")
    })

    faq_route = respx.get(
        f"{NODE}/internal/faqs/search"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"faqs": []},
            },
        )
    )

    catalog_route = respx.get(
        f"{NODE}/internal/catalog/search"
    ).mock(
        side_effect=FakeCatalog(PRODUCTS)
    )

    client = make_client(settings, llm)

    response = client.post(
        "/internal/customer-query",
        headers=bearer(make_token()),
        json={
            "message": "Where is my order?"
        },
    )

    assert response.status_code == 200
    assert faq_route.called is False
    assert catalog_route.called is False

    assert response.json()["matchedCount"] == 0


# TEST 6: FAQ lookup uses business ID from the service token
@respx.mock
def test_faq_lookup_uses_business_id_from_service_token(settings):
    llm = FakeLlm({
        Understanding: understands()
    })

    route = respx.get(
        f"{NODE}/internal/faqs/search"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": FAQ_RESPONSE,
            },
        )
    )

    client = make_client(settings, llm)

    client.post(
        "/internal/customer-query",
        headers=bearer(make_token()),
        json={
            "message": "What are your shop timings?",
            "businessId": "another-business",
        },
    )

    outgoing_token = route.calls.last.request.headers[
        "authorization"
    ].removeprefix("Bearer ")

    claims = jwt.decode(
        outgoing_token,
        SECRET,
        algorithms=["HS256"],
        audience="bizpilot-node",
        issuer="bizpilot-ai",
    )

    assert claims["business_id"] == BUSINESS_ID
    assert claims["business_id"] != "another-business"


# TEST 7: Node backend error must not become a fake FAQ answer
@respx.mock
def test_faq_backend_error_returns_502(settings):
    llm = FakeLlm({
        Understanding: understands()
    })

    respx.get(
        f"{NODE}/internal/faqs/search"
    ).mock(
        return_value=httpx.Response(
            500,
            json={
                "success": False,
                "message": "FAQ service unavailable",
            },
        )
    )

    client = make_client(settings, llm)

    response = client.post(
        "/internal/customer-query",
        headers=bearer(make_token()),
        json={
            "message": "What are your shop timings?"
        },
    )

    assert response.status_code == 502
    assert response.json()["code"] == "NODE_ERROR"


# TEST 8: Network failure must return NODE_UNAVAILABLE
@respx.mock
def test_faq_network_failure_returns_502(settings):
    llm = FakeLlm({
        Understanding: understands()
    })

    respx.get(
        f"{NODE}/internal/faqs/search"
    ).mock(
        side_effect=httpx.ConnectError("Connection refused")
    )

    client = make_client(settings, llm)

    response = client.post(
        "/internal/customer-query",
        headers=bearer(make_token()),
        json={
            "message": "What are your shop timings?"
        },
    )

    assert response.status_code == 502
    assert response.json()["code"] == "NODE_UNAVAILABLE"


# TEST 9: FAQ should still work when the language model is unavailable
@respx.mock
def test_faq_works_when_llm_is_unavailable(settings):
    # No handler: FakeLlm raises LlmError.
    # fallback_understanding detects "delivery" as an FAQ question.
    llm = FakeLlm()

    respx.get(
        f"{NODE}/internal/faqs/search"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": FAQ_RESPONSE,
            },
        )
    )

    client = make_client(settings, llm)

    response = client.post(
        "/internal/customer-query",
        headers=bearer(make_token()),
        json={
            "message": "What are your delivery timings?"
        },
    )

    assert response.status_code == 200
    assert response.json()["reply"] == (
        "Our shop is open from 9 AM to 9 PM."
    )


# TEST 10: Customer message must not be sent to a reply-writing model
@respx.mock
def test_faq_answer_does_not_use_reply_generation(settings):
    llm = FakeLlm({
        Understanding: understands()
    })

    respx.get(
        f"{NODE}/internal/faqs/search"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": FAQ_RESPONSE,
            },
        )
    )

    client = make_client(settings, llm)

    response = client.post(
        "/internal/customer-query",
        headers=bearer(make_token()),
        json={
            "message": "What are your shop timings?"
        },
    )

    assert response.status_code == 200

    from app.agents.customer.graph import Reply

    assert llm.calls_for(Reply) == []
