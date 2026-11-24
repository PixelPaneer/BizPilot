"""The only way this service reads business data: calls to the Node backend's /internal/* routes.

Each call carries a fresh service token that names the shop, so Node decides what that shop's data
is and this service never holds a database login.
"""

from typing import Any

import httpx

from app.config import Settings
from app.errors import ApiError
from app.security import sign_service_token


class NodeClient:
    def __init__(self, settings: Settings, http: httpx.AsyncClient | None = None):
        self._settings = settings
        self._http = http or httpx.AsyncClient(
            base_url=settings.node_api_url.rstrip("/"),
            timeout=settings.node_timeout_seconds,
        )

    async def get(self, business_id: str, path: str, params: dict[str, Any] | None = None) -> Any:
        """GET a Node route about one shop and return the `data` of its answer."""
        token = sign_service_token(business_id, self._settings)
        try:
            response = await self._http.get(
                path, params=params, headers={"Authorization": f"Bearer {token}"}
            )
        except httpx.HTTPError:
            raise ApiError(
                502, "The business backend could not be reached.", "NODE_UNAVAILABLE"
            ) from None

        try:
            payload = response.json()
        except ValueError:
            payload = None

        if response.status_code >= 400 or not isinstance(payload, dict) or not payload.get("success"):
            message = payload.get("message") if isinstance(payload, dict) else None
            raise ApiError(
                502,
                message or f"The business backend answered {response.status_code}.",
                "NODE_ERROR",
            )

        return payload.get("data")

    async def ping(self, business_id: str) -> Any:
        """Proves the shared secret works in this direction."""
        return await self.get(business_id, "/internal/ping")

    async def aclose(self) -> None:
        await self._http.aclose()
