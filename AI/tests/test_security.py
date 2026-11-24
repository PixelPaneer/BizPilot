import time

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.conftest import BUSINESS_ID, SECRET, bearer, make_token


def ping(client, headers=None):
    return client.post("/internal/ping", headers=headers or {})


def test_a_valid_token_is_accepted_and_names_the_shop(client):
    response = ping(client, bearer(make_token()))
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "businessId": BUSINESS_ID}


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": ""},
        {"Authorization": "Bearer"},
        {"Authorization": "Bearer "},
        {"Authorization": "Basic abc"},
        {"Authorization": "abc"},
    ],
)
def test_a_missing_or_malformed_header_is_refused(client, headers):
    response = ping(client, headers)
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHENTICATED"


def test_the_error_has_the_same_shape_as_the_node_backend(client):
    body = ping(client).json()
    assert set(body) == {"success", "message", "errors", "code"}
    assert body["success"] is False
    assert body["errors"] == []


def _now():
    return int(time.time())


@pytest.mark.parametrize(
    "token",
    [
        "not-a-token",
        make_token(secret="a-different-secret-a-different-secret-12"),  # wrong signature
        make_token(exp=_now() - 5, iat=_now() - 65),  # expired
        make_token(aud="someone-else"),
        make_token(iss="bizpilot-ai"),  # this service's own token cannot call this service
        make_token(iss="bizpilot-user"),
        make_token(iat=None),
        make_token(exp=None),
        make_token(business_id=None),
        make_token(business_id="not-a-uuid"),
        make_token(business_id=""),
        make_token(exp=_now() + 3600, iat=_now()),  # lives longer than the contract allows
    ],
)
def test_a_wrong_token_is_refused(client, token):
    response = ping(client, bearer(token))
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHENTICATED"


def test_a_token_signed_with_another_algorithm_is_refused(client):
    now = _now()
    token = jwt.encode(
        {"iss": "bizpilot-node", "aud": "bizpilot-ai", "business_id": BUSINESS_ID, "iat": now, "exp": now + 60},
        SECRET,
        algorithm="HS512",
    )
    assert ping(client, bearer(token)).status_code == 401


def test_without_a_secret_every_protected_route_answers_503():
    unconfigured = TestClient(create_app(Settings(service_jwt_secret="", _env_file=None)))
    response = unconfigured.post("/internal/ping", headers=bearer(make_token()))
    assert response.status_code == 503
    assert response.json()["code"] == "SERVICE_NOT_CONFIGURED"
    assert unconfigured.get("/health").status_code == 200


def test_the_token_never_appears_in_an_error_response(client):
    token = make_token(aud="someone-else")
    assert token not in ping(client, bearer(token)).text
