"""The FastAPI app. Run it with:  uvicorn app.main:app --port 8000"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api import health, internal
from app.config import Settings, get_settings
from app.errors import ApiError
from app.shared.logging import setup_logging
from app.tools.node_client import NodeClient


def _error_response(status_code: int, message: str, code: str, errors: list | None = None):
    body = {"success": False, "message": message, "errors": errors or [], "code": code}
    return JSONResponse(status_code=status_code, content=body)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    setup_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        await app.state.node_client.aclose()

    app = FastAPI(title="BizPilot AI service", lifespan=lifespan)
    app.state.node_client = NodeClient(settings)
    # Tests (and the app itself) can swap the settings through FastAPI's dependency system.
    app.dependency_overrides[get_settings] = lambda: settings

    app.include_router(health.router)
    app.include_router(internal.router)

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
