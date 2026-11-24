"""The Gemini client: one thin wrapper that asks for structured (JSON-schema) answers."""

import asyncio
from typing import Any

from google import genai
from google.genai import types
from pydantic import ValidationError

from app.config import Settings
from app.llm.base import LlmError, T

# The SDK enforces the timeout itself; this outer limit only catches a call that hangs past it.
SDK_TIMEOUT_GRACE_SECONDS = 2.0

# "The model is busy" answers from Google (503 and friends) usually pass within a second.
TRANSIENT_STATUS_CODES = {500, 502, 503, 504}
RETRY_DELAY_SECONDS = 0.7


class GeminiClient:
    """Implements LlmClient with the google-genai SDK.

    Two attempts at most (no retry loops), for one of two reasons: the answer was not valid JSON for
    the schema, or Google said the model is busy (a 5xx answer). Timeouts and other errors (a bad key,
    a wrong model name, no quota left) are not retried: the caller falls back to a fixed reply instead.
    """

    def __init__(self, settings: Settings, sdk_client: Any | None = None):
        if sdk_client is None and not settings.gemini_api_key:
            raise LlmError("GEMINI_API_KEY is not set.")
        self._model = settings.gemini_text_model
        self._timeout = settings.gemini_timeout_seconds
        self._client = sdk_client or genai.Client(api_key=settings.gemini_api_key)

    async def generate(self, *, system: str, user: str, schema: type[T], temperature: float = 0.0) -> T:
        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=schema,
            temperature=temperature,
            http_options=types.HttpOptions(timeout=int(self._timeout * 1000)),
        )

        for attempt in (1, 2):
            try:
                response = await asyncio.wait_for(
                    self._client.aio.models.generate_content(
                        model=self._model, contents=user, config=config
                    ),
                    timeout=self._timeout + SDK_TIMEOUT_GRACE_SECONDS,
                )
            except Exception as error:  # noqa: BLE001 - any SDK, network or timeout error
                if attempt == 1 and getattr(error, "code", None) in TRANSIENT_STATUS_CODES:
                    await asyncio.sleep(RETRY_DELAY_SECONDS)
                    continue
                # Deliberately not chained or formatted: the error text could echo the prompt.
                raise LlmError("The language model request failed.") from None

            try:
                return schema.model_validate_json(response.text or "")
            except (ValidationError, ValueError, TypeError):
                if attempt == 2:
                    raise LlmError("The language model did not return a valid answer.") from None

        raise LlmError("The language model did not return a valid answer.")  # pragma: no cover
