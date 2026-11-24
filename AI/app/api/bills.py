from fastapi import APIRouter, Depends, Query, Request

from app.agents.inventory.stock_draft import StockDraft, draft_from_image, draft_from_voice
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

IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


@router.post("/bills/extract", response_model=StockDraft)
async def extract_bill(
    request: Request,
    type: str | None = Query(default=None, pattern="^(SALE|PURCHASE)$"),
    context: ServiceContext = Depends(require_service_token),
    settings: Settings = Depends(get_settings),
) -> StockDraft:
    """A voice note or a bill photo (the raw file as the body, its type in Content-Type) in, an
    editable stock draft out. Nothing is stored."""
    mime_type = (request.headers.get("content-type") or "").split(";")[0].strip().lower()
    if mime_type not in AUDIO_TYPES and mime_type not in IMAGE_TYPES:
        raise ApiError(
            400,
            "Send a voice note (webm, ogg, mp3, m4a, wav) or a bill photo (jpeg, png, webp).",
            "UNSUPPORTED_MEDIA",
        )
    is_image = mime_type in IMAGE_TYPES

    data = await request.body()
    if not data:
        raise ApiError(400, "The file is empty.", "EMPTY_FILE")
    if len(data) > (settings.max_image_bytes if is_image else settings.max_audio_bytes):
        raise ApiError(413, "The file is too large.", "FILE_TOO_LARGE")

    try:
        if is_image:
            return await draft_from_image(
                context.business_id,
                data,
                "image/jpeg" if mime_type == "image/jpg" else mime_type,
                type_hint=type,
                vision=request.app.state.vision,
                node=request.app.state.node_client,
            )
        return await draft_from_voice(
            context.business_id,
            data,
            mime_type,
            type_hint=type,
            transcriber=request.app.state.transcriber,
            llm=request.app.state.llm,
            node=request.app.state.node_client,
            return_transcript=settings.debug_return_transcript,
        )
    except LlmError:
        raise ApiError(502, "The file could not be read.", "AI_EXTRACTION_FAILED") from None
