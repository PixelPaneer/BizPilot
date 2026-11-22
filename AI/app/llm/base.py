"""The shape of a language-model client, so the flows can be tested with a fake one."""

from typing import Protocol, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LlmError(Exception):
    """The model could not give a usable answer (down, slow, refused, or not valid JSON).

    The message never contains the prompt or the model's text: those can hold a customer's words.
    """


class LlmClient(Protocol):
    async def generate(
        self,
        *,
        system: str,
        user: str,
        schema: type[T],
        temperature: float = 0.0,
    ) -> T:
        """Asks the model for an answer that matches `schema` (structured output).

        `system` holds the instructions. `user` holds untrusted input (a customer's message): it is
        always sent as the user turn and never mixed into the instructions.
        Raises LlmError for any failure."""
        ...
