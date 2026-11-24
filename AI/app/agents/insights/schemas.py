"""Pydantic contracts for the Insights Agent."""

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

Period = Literal["last7", "last30", "last90", "thisMonth"]
Mode = Literal["dashboard", "question"]


class InsightsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Mode
    period: Period = "last30"
    question: str | None = Field(default=None, min_length=1, max_length=500)

    @model_validator(mode="after")
    def require_question_for_question_mode(self):
        if self.mode == "question" and not self.question:
            raise ValueError("question is required when mode is 'question'")
        return self


class InsightItem(BaseModel):
    title: str
    observation: str
    recommendation: str


class InsightsAnswer(BaseModel):
    summary: str
    insights: list[InsightItem] = Field(default_factory=list)


class InsightsResponse(BaseModel):
    mode: Mode
    period: Period
    summary: str
    insights: list[InsightItem]
    used_fallback: bool = False
