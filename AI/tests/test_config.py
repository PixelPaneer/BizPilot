import pytest
from pydantic import ValidationError

from app.config import Settings


def test_a_short_secret_is_rejected():
    with pytest.raises(ValidationError):
        Settings(service_jwt_secret="too-short", _env_file=None)


def test_an_empty_secret_means_not_set_up_yet():
    assert Settings(_env_file=None).service_jwt_secret == ""


@pytest.mark.parametrize("ttl", [0, 61, -5])
def test_the_token_lifetime_is_limited_to_a_minute(ttl):
    with pytest.raises(ValidationError):
        Settings(service_token_ttl_seconds=ttl, _env_file=None)
