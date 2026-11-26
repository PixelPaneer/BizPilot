"""Turns agent output into short WhatsApp-friendly text and holds the fixed replies."""

from app.agents.insights.schemas import InsightsResponse

MAX_REPLY_CHARS = 1000
MAX_INSIGHT_LINES = 2

APP_REDIRECT_REPLY = (
    "Hi! For stock updates, sales and purchases please use the BizPilot app. "
    "Here you can ask me questions like \"Which products sold the most this month?\""
)
UNAVAILABLE_REPLY = "Sorry, I could not get that right now. Please try again in a little while."


def format_insights_reply(result: InsightsResponse) -> str:
    lines = [result.summary.strip()]
    for item in result.insights[:MAX_INSIGHT_LINES]:
        lines.append(f"- {item.title}: {item.recommendation}")
    return "\n".join(lines)[:MAX_REPLY_CHARS]