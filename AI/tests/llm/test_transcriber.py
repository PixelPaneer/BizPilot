from types import SimpleNamespace

import pytest

from app.config import Settings
from app.llm import transcribe
from app.llm.base import LlmError
from app.llm.transcribe import TRANSCRIBE_SYSTEM, GeminiTranscriber


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
    return GeminiTranscriber(Settings(_env_file=None, **settings), sdk_client=sdk), sdk


async def test_the_audio_goes_to_the_transcribe_model_and_the_words_come_back():
    client, sdk = make(["  Parle-G 50 aur aaye \n"], gemini_transcribe_model="a-speech-model")

    assert await client.transcribe(b"AUDIO", "audio/webm") == "Parle-G 50 aur aaye"

    call = sdk.calls[0]
    assert call["model"] == "a-speech-model"
    assert call["config"].system_instruction == TRANSCRIBE_SYSTEM
    part = call["contents"][0]
    assert part.inline_data.data == b"AUDIO" and part.inline_data.mime_type == "audio/webm"


async def test_no_speech_is_an_empty_string():
    client, _ = make([None])
    assert await client.transcribe(b"AUDIO", "audio/webm") == ""


async def test_a_busy_model_is_tried_once_more(monkeypatch):
    monkeypatch.setattr(transcribe, "RETRY_DELAY_SECONDS", 0)
    client, sdk = make([BusyError("high demand"), "ok"])
    assert await client.transcribe(b"A", "audio/webm") == "ok"
    assert len(sdk.calls) == 2


async def test_other_errors_fail_at_once_without_leaking_their_text():
    client, sdk = make([RuntimeError("bad request about SECRET-SPOKEN-WORDS")])
    with pytest.raises(LlmError) as caught:
        await client.transcribe(b"A", "audio/webm")
    assert len(sdk.calls) == 1
    assert "SECRET-SPOKEN-WORDS" not in str(caught.value)


def test_without_an_api_key_there_is_no_transcriber():
    with pytest.raises(LlmError):
        GeminiTranscriber(Settings(_env_file=None, gemini_api_key=""))
