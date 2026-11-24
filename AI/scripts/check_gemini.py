"""Checks that GEMINI_API_KEY and GEMINI_TEXT_MODEL in AI/.env work, with one small real request.

    .\\.venv\\Scripts\\python scripts\\check_gemini.py

Sends a made-up customer message (no real data) and prints how the model understood it. It never
prints the key. Use it after changing the model name: model ids change over time, and a wrong one
shows up here as "request failed".
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agents.customer.prompts import UNDERSTAND_SYSTEM  # noqa: E402
from app.agents.customer.schemas import Understanding  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.llm.base import LlmError  # noqa: E402
from app.llm.gemini import GeminiClient  # noqa: E402

# Windows consoles often cannot print Hindi unless told to use UTF-8.
sys.stdout.reconfigure(encoding="utf-8")

SAMPLES = ["Parle-G 50g available hai kya?", "पारले जी का रेट क्या है", "hello"]


async def explain_failure(client: GeminiClient, settings, sample: str) -> None:
    """Repeats the request straight through the SDK to show the reason. The service itself hides
    error text (it could echo a customer's message); here the message is made up, and the key is
    removed from whatever is printed."""
    try:
        await client._client.aio.models.generate_content(model=settings.gemini_text_model, contents=sample)
    except Exception as error:  # noqa: BLE001
        detail = str(error).replace(settings.gemini_api_key, "***")[:400]
        print(f"reason: {type(error).__name__} code={getattr(error, 'code', None)} {detail}")
    else:
        print("reason: a plain request works, so the problem is the structured-output request")


async def main() -> int:
    settings = get_settings()
    print(f"model: {settings.gemini_text_model}")
    try:
        client = GeminiClient(settings)
    except LlmError as error:
        print(f"cannot start: {error}")
        return 1

    for sample in SAMPLES:
        try:
            result = await client.generate(system=UNDERSTAND_SYSTEM, user=sample, schema=Understanding)
        except LlmError as error:
            print(f"{sample!r}: request failed ({error}). Check the key, the model name and your quota.")
            await explain_failure(client, settings, sample)
            return 1
        print(f"{sample!r} -> {result.model_dump()}")
    print("ok")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
