import time
import uuid

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

SECRET = "test-secret-test-secret-test-secret-1234"
BUSINESS_ID = str(uuid.uuid4())


@pytest.fixture
def settings() -> Settings:
    return Settings(service_jwt_secret=SECRET, node_api_url="http://node.test", _env_file=None)


@pytest.fixture
def client(settings) -> TestClient:
    return TestClient(create_app(settings))


def make_token(secret: str = SECRET, **overrides) -> str:
    """A token as Node would make it. Any claim can be changed, or removed by setting it to None."""
    now = int(time.time())
    claims = {
        "iss": "bizpilot-node",
        "aud": "bizpilot-ai",
        "business_id": BUSINESS_ID,
        "iat": now,
        "exp": now + 60,
    }
    claims.update(overrides)
    claims = {key: value for key, value in claims.items() if value is not None}
    return jwt.encode(claims, secret, algorithm="HS256")


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
