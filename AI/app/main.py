"""The FastAPI app. Run it with:  uvicorn app.main:app --port 8000"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.agents.customer.graph import build_customer_graph
from app.api import bills, customer, health, insights, internal
from app.config import Settings, get_settings
from app.errors import ApiError
from app.llm.base import LlmClient, LlmError
from app.llm.gemini import GeminiClient
from app.llm.transcribe import GeminiTranscriber
from app.llm.vision import GeminiVision
from app.shared.logging import setup_logging
from app.tools.node_client import NodeClient
from app.agents.insights.agent import InsightsAgent

class _NoModel:
    """Stands in when GEMINI_API_KEY is not set: every call fails, so the service still answers with
    its fixed replies instead of refusing to start."""

    async def generate(self, **kwargs):
        raise LlmError("No language model is configured.")


def _make_llm(settings: Settings) -> LlmClient:
    try:
        return GeminiClient(settings)
    except LlmError:
        return _NoModel()


class _NoTranscriber:
    async def transcribe(self, audio: bytes, mime_type: str) -> str:
        raise LlmError("No speech model is configured.")


def _make_transcriber(settings: Settings):
    try:
        return GeminiTranscriber(settings)
    except LlmError:
        return _NoTranscriber()


class _NoVision:
    async def read(self, **kwargs):
        raise LlmError("No image model is configured.")


def _make_vision(settings: Settings):
    try:
        return GeminiVision(settings)
    except LlmError:
        return _NoVision()


def _error_response(status_code: int, message: str, code: str, errors: list | None = None):
    body = {"success": False, "message": message, "errors": errors or [], "code": code}
    return JSONResponse(status_code=status_code, content=body)


def create_app(
    settings: Settings | None = None, llm: LlmClient | None = None, transcriber=None, vision=None
) -> FastAPI:
    settings = settings or get_settings()
    setup_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        await app.state.node_client.aclose()

    app = FastAPI(title="BizPilot AI service", lifespan=lifespan)



    app.state.node_client = NodeClient(settings)
    app.state.llm = llm or _make_llm(settings)
    app.state.transcriber = transcriber or _make_transcriber(settings)
    app.state.vision = vision or _make_vision(settings)
    app.state.customer_graph = build_customer_graph(app.state.llm, app.state.node_client)

    # Tests (and the app itself) can swap the settings through FastAPI's dependency system.
    app.state.insights_agent = InsightsAgent(
        app.state.llm,
        app.state.node_client
    )
    app.dependency_overrides[get_settings] = lambda: settings

    app.include_router(health.router)
    app.include_router(internal.router)
    app.include_router(customer.router)
    app.include_router(bills.router)

    # NEW: Insights API
    app.include_router(insights.router)

    @app.exception_handler(ApiError)
    async def handle_api_error(request: Request, error: ApiError):
        return _error_response(error.status_code, error.message, error.code, error.errors)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, error: RequestValidationError):
        details = [
            {"field": ".".join(str(part) for part in item["loc"][1:]), "message": item["msg"]}
            for item in error.errors()
        ]
        return _error_response(400, "Validation failed", "VALIDATION_ERROR", details)

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, error: Exception):
        # Never echo the error text: it could contain a customer's message.
        return _error_response(500, "Internal server error", "INTERNAL_ERROR")

    return app


app = create_app()
