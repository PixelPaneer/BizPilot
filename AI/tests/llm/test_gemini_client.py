import asyncio
from types import SimpleNamespace

import pytest
from pydantic import BaseModel

from app.config import Settings
from app.llm import gemini
from app.llm.base import LlmError
from app.llm.gemini import GeminiClient


class Answer(BaseModel):
    word: str


class FakeSdk:
    """The part of the google-genai client that GeminiClient uses."""

    def __init__(self, behaviours):
        self.behaviours = list(behaviours)
        self.calls = []
        self.aio = SimpleNamespace(models=SimpleNamespace(generate_content=self._generate))

    async def _generate(self, *, model, contents, config):
        self.calls.append({"model": model, "contents": contents, "config": config})
        behaviour = self.behaviours.pop(0)
        if isinstance(behaviour, Exception):
            raise behaviour
        if callable(behaviour):
            return await behaviour()
        return SimpleNamespace(text=behaviour)


def make(behaviours, **settings):
    sdk = FakeSdk(behaviours)
    return GeminiClient(Settings(_env_file=None, **settings), sdk_client=sdk), sdk


async def test_a_valid_answer_is_returned_as_the_schema():
    client, sdk = make(['{"word": "hello"}'], gemini_text_model="a-model", gemini_timeout_seconds=7)

    result = await client.generate(system="SYSTEM TEXT", user="USER TEXT", schema=Answer, temperature=0.2)

    assert result == Answer(word="hello")
    call = sdk.calls[0]
    assert call["model"] == "a-model"
    assert call["contents"] == "USER TEXT", "the customer's text is the user turn"
    assert call["config"].system_instruction == "SYSTEM TEXT", "and never part of the instructions"
    assert call["config"].temperature == 0.2
    assert call["config"].response_mime_type == "application/json"
    assert call["config"].http_options.timeout == 7000


async def test_an_answer_that_is_not_valid_is_retried_once():
    client, sdk = make(["not json", '{"word": "ok"}'])
    assert (await client.generate(system="s", user="u", schema=Answer)).word == "ok"
    assert len(sdk.calls) == 2


async def test_two_invalid_answers_fail_without_repeating_the_text():
    client, sdk = make(["SECRET-CUSTOMER-WORDS", '{"wrong": 1}'])
    with pytest.raises(LlmError) as caught:
        await client.generate(system="s", user="u", schema=Answer)
    assert len(sdk.calls) == 2
    assert "SECRET-CUSTOMER-WORDS" not in str(caught.value)


class BusyError(Exception):
    """What the SDK raises when Google answers 503."""

    code = 503


async def test_a_busy_model_is_tried_once_more(monkeypatch):
    monkeypatch.setattr(gemini, "RETRY_DELAY_SECONDS", 0)
    client, sdk = make([BusyError("high demand"), '{"word": "ok"}'])
    assert (await client.generate(system="s", user="u", schema=Answer)).word == "ok"
    assert len(sdk.calls) == 2


async def test_a_model_that_stays_busy_fails_after_two_attempts(monkeypatch):
    monkeypatch.setattr(gemini, "RETRY_DELAY_SECONDS", 0)
    client, sdk = make([BusyError("SECRET-CUSTOMER-WORDS"), BusyError("SECRET-CUSTOMER-WORDS")])
    with pytest.raises(LlmError) as caught:
        await client.generate(system="s", user="u", schema=Answer)
    assert len(sdk.calls) == 2
    assert "SECRET-CUSTOMER-WORDS" not in str(caught.value)


async def test_an_api_error_is_not_retried_and_does_not_leak_its_text():
    client, sdk = make([RuntimeError("quota exceeded for prompt: SECRET-CUSTOMER-WORDS")])
    with pytest.raises(LlmError) as caught:
        await client.generate(system="s", user="SECRET-CUSTOMER-WORDS", schema=Answer)
    assert len(sdk.calls) == 1
    assert "SECRET-CUSTOMER-WORDS" not in str(caught.value)
    assert caught.value.__cause__ is None and caught.value.__suppress_context__


async def test_a_call_that_hangs_becomes_an_error(monkeypatch):
    monkeypatch.setattr(gemini, "SDK_TIMEOUT_GRACE_SECONDS", 0.0)

    async def hang():
        await asyncio.sleep(5)

    client, _ = make([hang], gemini_timeout_seconds=0.05)
    with pytest.raises(LlmError):
        await client.generate(system="s", user="u", schema=Answer)


def test_without_an_api_key_there_is_no_client():
    with pytest.raises(LlmError):
        GeminiClient(Settings(_env_file=None, gemini_api_key=""))
