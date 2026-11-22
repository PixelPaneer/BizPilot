"""Service tokens: how the Node backend and this service prove who they are to each other.

A token is a short-lived JWT (HS256) signed with the shared secret. It names the shop it is about
(`business_id`), so this service can only ever see one shop's data per request, and the model never
chooses the shop.

  Node -> AI:  iss "bizpilot-node", aud "bizpilot-ai"
  AI -> Node:  iss "bizpilot-ai",   aud "bizpilot-node"
"""

import time
import uuid
from dataclasses import dataclass

import jwt
from fastapi import Depends, Request

from app.config import Settings, get_settings
from app.errors import ApiError

NODE_ISSUER = "bizpilot-node"
AI_ISSUER = "bizpilot-ai"
MAX_TOKEN_LIFETIME_SECONDS = 60


def _unauthenticated(message: str = "Authentication required.") -> ApiError:
    return ApiError(401, message, "UNAUTHENTICATED")


@dataclass(frozen=True)
class ServiceContext:
    """What a verified token tells us: which shop this request is about."""

    business_id: str


def _require_secret(settings: Settings) -> str:
    if not settings.service_jwt_secret:
        raise ApiError(
            503,
            "The AI service is not configured (SERVICE_JWT_SECRET is missing).",
            "SERVICE_NOT_CONFIGURED",
        )
    return settings.service_jwt_secret


def verify_service_token(token: str, settings: Settings) -> ServiceContext:
    """Checks a token from Node. Raises ApiError(401) for anything wrong with it."""
    secret = _require_secret(settings)

    try:
        claims = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],  # never accept the algorithm the token asks for
            issuer=NODE_ISSUER,
            audience=AI_ISSUER,
            options={"require": ["exp", "iat", "iss", "aud"]},
        )
    except jwt.PyJWTError:
        # Expired, wrong signature, wrong issuer or audience, missing claim, not a JWT at all:
        # the caller does not need to know which.
        raise _unauthenticated("The service token is invalid or has expired.") from None

    # A token that lives longer than the contract allows is refused even if it is otherwise valid.
    if claims["exp"] - claims["iat"] > MAX_TOKEN_LIFETIME_SECONDS:
        raise _unauthenticated("The service token lives longer than allowed.")

    business_id = claims.get("business_id")
    try:
        business_id = str(uuid.UUID(str(business_id)))
    except (ValueError, AttributeError, TypeError):
        raise _unauthenticated("The service token does not name a shop.") from None

    return ServiceContext(business_id=business_id)


def sign_service_token(business_id: str, settings: Settings, now: float | None = None) -> str:
    """Makes a token for a call from this service to Node, about one shop."""
    secret = _require_secret(settings)
    issued_at = int(now if now is not None else time.time())
    return jwt.encode(
        {
            "iss": AI_ISSUER,
            "aud": NODE_ISSUER,
            "business_id": business_id,
            "iat": issued_at,
            "exp": issued_at + settings.service_token_ttl_seconds,
        },
        secret,
        algorithm="HS256",
    )


def require_service_token(
    request: Request, settings: Settings = Depends(get_settings)
) -> ServiceContext:
    """FastAPI dependency for every route except /health: the caller must send a valid token."""
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise _unauthenticated()
    return verify_service_token(token.strip(), settings)
