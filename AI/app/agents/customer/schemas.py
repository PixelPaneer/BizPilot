
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Language = Literal["english", "hindi", "hinglish"]


class Mention(BaseModel):
    """One product the customer wrote about."""

    text: str = Field(
        description="The product name exactly as the customer wrote it."
    )
    latin_text: str = Field(
        description="The same product name in Latin letters (transliterated if it was not)."
    )
    size_or_unit: str | None = Field(
        default=None,
        description="A size or pack the customer named, e.g. '50g'."
    )
    price_hint: float | None = Field(
        default=None,
        description="A price the customer named, in rupees."
    )


class Understanding(BaseModel):
    intent: Literal["product_query", "faq_query", "greeting", "other"]
    mentions: list[Mention] = Field(default_factory=list)
    language: Language


class CustomerQueryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message: str = Field(min_length=1, max_length=1000)
    shop_name: str | None = Field(default=None, alias="shopName", max_length=100)


class CustomerQueryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    reply: str
    language: Language
    matched_count: int = Field(alias="matchedCount")
