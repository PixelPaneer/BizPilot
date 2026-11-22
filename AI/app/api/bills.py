from fastapi import APIRouter, Depends, Query, Request

from app.agents.inventory.stock_draft import StockDraft, draft_from_voice
from app.config import Settings, get_settings
from app.errors import ApiError
from app.llm.base import LlmError
from app.security import ServiceContext, require_service_token

router = APIRouter(prefix="/internal", dependencies=[Depends(require_service_token)])

AUDIO_TYPES = {
    "audio/webm",
    "audio/ogg",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/wav",
    "audio/x-wav",
}


@router.post("/bills/extract", response_model=StockDraft)
async def extract_bill(
    request: Request,
    type: str | None = Query(default=None, pattern="^(SALE|PURCHASE)$"),
    context: ServiceContext = Depends(require_service_token),
    settings: Settings = Depends(get_settings),
) -> StockDraft:
    """A voice note (the raw audio as the body) in, an editable stock draft out. Nothing is stored."""
    mime_type = (request.headers.get("content-type") or "").split(";")[0].strip().lower()
    if mime_type not in AUDIO_TYPES:
        raise ApiError(
            400, "Send the voice note as audio (webm, ogg, mp3, m4a or wav).", "UNSUPPORTED_MEDIA"
        )

    audio = await request.body()
    if not audio:
        raise ApiError(400, "The voice note is empty.", "EMPTY_AUDIO")
    if len(audio) > settings.max_audio_bytes:
        raise ApiError(413, "The voice note is too large.", "AUDIO_TOO_LARGE")

    try:
        return await draft_from_voice(
            context.business_id,
            audio,
            mime_type,
            type_hint=type,
            transcriber=request.app.state.transcriber,
            llm=request.app.state.llm,
            node=request.app.state.node_client,
            return_transcript=settings.debug_return_transcript,
        )
    except LlmError:
        raise ApiError(502, "The voice note could not be read.", "AI_EXTRACTION_FAILED") from None
