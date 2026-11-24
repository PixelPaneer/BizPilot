import json
import logging

import pytest

from app.shared.logging import log_event


@pytest.mark.parametrize(
    "field", ["message", "text", "transcript", "audio", "image", "token", "Authorization"]
)
def test_content_and_secret_fields_cannot_be_logged(field):
    with pytest.raises(ValueError):
        log_event("something", **{field: "anything"})


def test_metadata_is_logged_as_one_json_line(caplog):
    with caplog.at_level(logging.INFO, logger="bizpilot.ai"):
        log_event("customer_query", flow="customer", duration_ms=12, error_code=None)
    record = json.loads(caplog.records[-1].getMessage())
    assert record == {"event": "customer_query", "flow": "customer", "duration_ms": 12, "error_code": None}
