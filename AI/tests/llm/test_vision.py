from types import SimpleNamespace

import pytest
from pydantic import BaseModel

from app.config import Settings
from app.llm import vision
from app.llm.base import LlmError
from app.llm.vision import GeminiVision


class Answer(BaseModel):
    word: str


class BusyError(Exception):
    code = 503


class FakeSdk:
    def __init__(self, behaviours):
        self.behaviours = list(behaviours)
        self.calls = []
        self.aio = SimpleNamespace(models=SimpleNamespace(generate_content=self._generate))

    async def _generate(self, *, model, contents, config):
        self.calls.append({"model": model, "contents": contents, "config": config})
        behaviour = self.behaviours.pop(0)
        if isinstance(behaviour, Exception):
            raise behaviour
        return SimpleNamespace(text=behaviour)


def make(behaviours, **settings):
    sdk = FakeSdk(behaviours)
    return GeminiVision(Settings(_env_file=None, **settings), sdk_client=sdk), sdk


async def test_the_image_goes_to_the_vision_model_with_a_schema_and_the_answer_is_validated():
    client, sdk = make(
        ['{"word": "hi"}'], gemini_vision_model="a-vision-model", gemini_vision_timeout_seconds=9
    )

    result = await client.read(system="SYSTEM", image=b"IMG", mime_type="image/png", schema=Answer)

    assert result == Answer(word="hi")
    call = sdk.calls[0]
    assert call["model"] == "a-vision-model"
    assert call["config"].system_instruction == "SYSTEM"
    assert call["config"].response_mime_type == "application/json"
    assert call["config"].http_options.timeout == 9000
    part = call["contents"][0]
    assert part.inline_data.data == b"IMG" and part.inline_data.mime_type == "image/png"


async def test_an_invalid_answer_is_retried_once_and_then_fails_quietly():
    client, sdk = make(["nope", '{"word": "ok"}'])
    assert (await client.read(system="s", image=b"i", mime_type="image/png", schema=Answer)).word == "ok"

    client, sdk = make(["SECRET-BILL-TEXT", '{"bad": 1}'])
    with pytest.raises(LlmError) as caught:
        await client.read(system="s", image=b"i", mime_type="image/png", schema=Answer)
    assert len(sdk.calls) == 2 and "SECRET-BILL-TEXT" not in str(caught.value)


async def test_a_busy_model_is_tried_once_more(monkeypatch):
    monkeypatch.setattr(vision, "RETRY_DELAY_SECONDS", 0)
    client, sdk = make([BusyError("high demand"), '{"word": "ok"}'])
    assert (await client.read(system="s", image=b"i", mime_type="image/png", schema=Answer)).word == "ok"
    assert len(sdk.calls) == 2


async def test_other_errors_fail_at_once_without_leaking_their_text():
    client, sdk = make([RuntimeError("quota exceeded for SECRET-BILL-TEXT")])
    with pytest.raises(LlmError) as caught:
        await client.read(system="s", image=b"i", mime_type="image/png", schema=Answer)
    assert len(sdk.calls) == 1 and "SECRET-BILL-TEXT" not in str(caught.value)


def test_without_an_api_key_there_is_no_reader():
    with pytest.raises(LlmError):
        GeminiVision(Settings(_env_file=None, gemini_api_key=""))
