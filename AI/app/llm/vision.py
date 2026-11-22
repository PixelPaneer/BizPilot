"""Reading a bill photo: one thin wrapper around a Gemini model that accepts images."""

import asyncio
from typing import Any, Protocol

from google import genai
from google.genai import types
from pydantic import ValidationError

from app.config import Settings
from app.llm.base import LlmError, T
from app.llm.gemini import RETRY_DELAY_SECONDS, SDK_TIMEOUT_GRACE_SECONDS, TRANSIENT_STATUS_CODES


class VisionReader(Protocol):
    async def read(self, *, system: str, image: bytes, mime_type: str, schema: type[T]) -> T:
        """Asks the model to read `image` into an answer that matches `schema`. Raises LlmError."""
        ...


class GeminiVision:
    """Same rules as GeminiClient: structured output, at most two attempts (invalid JSON, or Google
    says it is busy), and error text is never passed on (it could echo what the photo shows)."""

    def __init__(self, settings: Settings, sdk_client: Any | None = None):
        if sdk_client is None and not settings.gemini_api_key:
            raise LlmError("GEMINI_API_KEY is not set.")
        self._model = settings.gemini_vision_model
        self._timeout = settings.gemini_vision_timeout_seconds
        self._client = sdk_client or genai.Client(api_key=settings.gemini_api_key)

    async def read(self, *, system: str, image: bytes, mime_type: str, schema: type[T]) -> T:
        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=schema,
            temperature=0.0,
            http_options=types.HttpOptions(timeout=int(self._timeout * 1000)),
        )
        contents = [types.Part.from_bytes(data=image, mime_type=mime_type)]

        for attempt in (1, 2):
            try:
                response = await asyncio.wait_for(
                    self._client.aio.models.generate_content(
                        model=self._model, contents=contents, config=config
                    ),
                    timeout=self._timeout + SDK_TIMEOUT_GRACE_SECONDS,
                )
            except Exception as error:  # noqa: BLE001 - any SDK, network or timeout error
                if attempt == 1 and getattr(error, "code", None) in TRANSIENT_STATUS_CODES:
                    await asyncio.sleep(RETRY_DELAY_SECONDS)
                    continue
                raise LlmError("The image model request failed.") from None

            try:
                return schema.model_validate_json(response.text or "")
            except (ValidationError, ValueError, TypeError):
                if attempt == 2:
                    raise LlmError("The image model did not return a valid answer.") from None

        raise LlmError("The image model did not return a valid answer.")  # pragma: no cover
