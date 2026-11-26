"""Pydantic contracts for the Orchestrator."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.agents.insights.schemas import Period

SenderRole = Literal["customer", "owner"]
Route = Literal["customer", "insights", "app_redirect", "unavailable"]


class OrchestrateRequest(BaseModel):
    """One WhatsApp text message. `sender_role` is decided by the caller (Node), never by the message."""

    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=1000)
    sender_role: SenderRole = Field(alias="senderRole")
    shop_name: str | None = Field(default=None, alias="shopName", max_length=100)


class OrchestrateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    reply: str
    route: Route
    language: str | None = None


class OwnerIntent(BaseModel):
    """What a shop owner's message is asking for (LLM structured output)."""

    intent: Literal["insights_question", "stock_update", "greeting", "other"]
    period: Period