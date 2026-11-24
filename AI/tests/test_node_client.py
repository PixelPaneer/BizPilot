import httpx
import jwt
import pytest
import respx

from app.errors import ApiError
from app.tools.node_client import NodeClient
from tests.conftest import BUSINESS_ID, SECRET, bearer, make_token

NODE = "http://node.test"


@pytest.fixture
def node_client(settings):
    return NodeClient(settings)


def decode_outgoing(authorization: str) -> dict:
    return jwt.decode(
        authorization.removeprefix("Bearer "),
        SECRET,
        algorithms=["HS256"],
        audience="bizpilot-node",
        issuer="bizpilot-ai",
    )


@respx.mock
async def test_a_call_carries_a_token_naming_the_shop(node_client):
    route = respx.get(f"{NODE}/internal/ping").mock(
        return_value=httpx.Response(200, json={"success": True, "data": {"businessId": BUSINESS_ID}})
    )

    data = await node_client.ping(BUSINESS_ID)

    assert data == {"businessId": BUSINESS_ID}
    claims = decode_outgoing(route.calls.last.request.headers["authorization"])
    assert claims["business_id"] == BUSINESS_ID
    assert claims["exp"] - claims["iat"] == 60


@respx.mock
async def test_a_node_error_becomes_a_502(node_client):
    respx.get(f"{NODE}/internal/ping").mock(
        return_value=httpx.Response(401, json={"success": False, "message": "Authentication required."})
    )
    with pytest.raises(ApiError) as caught:
        await node_client.ping(BUSINESS_ID)
    assert caught.value.status_code == 502
    assert caught.value.code == "NODE_ERROR"


@respx.mock
async def test_an_unreachable_node_becomes_502_node_unavailable(node_client):
    respx.get(f"{NODE}/internal/ping").mock(side_effect=httpx.ConnectError("refused"))
    with pytest.raises(ApiError) as caught:
        await node_client.ping(BUSINESS_ID)
    assert caught.value.status_code == 502
    assert caught.value.code == "NODE_UNAVAILABLE"


@respx.mock
async def test_a_timeout_becomes_502_node_unavailable(node_client):
    respx.get(f"{NODE}/internal/ping").mock(side_effect=httpx.ReadTimeout("slow"))
    with pytest.raises(ApiError) as caught:
        await node_client.ping(BUSINESS_ID)
    assert caught.value.code == "NODE_UNAVAILABLE"


@respx.mock
async def test_a_reply_that_is_not_json_is_an_error(node_client):
    respx.get(f"{NODE}/internal/ping").mock(return_value=httpx.Response(200, text="<html>oops</html>"))
    with pytest.raises(ApiError) as caught:
        await node_client.ping(BUSINESS_ID)
    assert caught.value.code == "NODE_ERROR"


@respx.mock
def test_check_node_proves_the_secret_works_in_both_directions(client):
    route = respx.get(f"{NODE}/internal/ping").mock(
        return_value=httpx.Response(200, json={"success": True, "data": {"businessId": BUSINESS_ID}})
    )

    response = client.get("/internal/check-node", headers=bearer(make_token()))

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "node": {"businessId": BUSINESS_ID}}
    outgoing = decode_outgoing(route.calls.last.request.headers["authorization"])
    assert outgoing["business_id"] == BUSINESS_ID, "Node is asked about the shop in the incoming token"


def test_check_node_needs_a_token(client):
    assert client.get("/internal/check-node").status_code == 401
