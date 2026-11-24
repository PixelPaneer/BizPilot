"""Logging that records only metadata.

This service handles customers' messages, owners' voice notes and bill photos. None of that may ever
reach a log. `log_event` accepts only plain facts about what happened (which flow, how long, which
error code) and refuses field names that would carry content or secrets.
"""

import json
import logging
import sys

# Field names that must never be logged. Passing one is a programming error and fails loudly.
FORBIDDEN_FIELDS = frozenset(
    {
        "message",
        "text",
        "transcript",
        "audio",
        "image",
        "body",
        "content",
        "prompt",
        "reply",
        "token",
        "authorization",
        "secret",
        "password",
    }
)

logger = logging.getLogger("bizpilot.ai")


def setup_logging(level: str = "info") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        stream=sys.stdout,
        format="%(message)s",
        force=True,
    )


def log_event(event: str, **fields: object) -> None:
    bad = FORBIDDEN_FIELDS.intersection(name.lower() for name in fields)
    if bad:
        raise ValueError(f"Refusing to log content or secret fields: {sorted(bad)}")
    logger.info(json.dumps({"event": event, **fields}, default=str))
