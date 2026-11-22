"""Settings, read from environment variables (or AI/.env). This is the only module that reads them."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 8000
    # Where the Node backend is, for the calls the AI service makes back to it.
    node_api_url: str = "http://localhost:5000"
    # The secret both services use to sign and check service tokens. It must be the same value as
    # SERVICE_JWT_SECRET in the Node backend. Empty means "not set up yet": every protected route
    # then answers 503 instead of accepting anything.
    service_jwt_secret: str = ""
    # How long a service token lives. The contract says 60 seconds at most.
    service_token_ttl_seconds: int = 60
    node_timeout_seconds: float = 10.0

    # Gemini. Each model is its own setting so any can be changed without touching code; the exact
    # ids must be checked on Google's models page (they change). The text model does everything in
    # the customer flow: understanding the message and writing the reply.
    gemini_api_key: str = ""
    gemini_text_model: str = "gemini-3.5-flash-lite"
    gemini_timeout_seconds: float = 20.0
    log_level: str = "info"

    @field_validator("service_jwt_secret")
    @classmethod
    def secret_must_be_long_enough(cls, value: str) -> str:
        value = value.strip()
        if value and len(value) < 32:
            raise ValueError("SERVICE_JWT_SECRET must be at least 32 characters long.")
        return value

    @field_validator("service_token_ttl_seconds")
    @classmethod
    def ttl_must_be_short(cls, value: int) -> int:
        if not 1 <= value <= 60:
            raise ValueError("SERVICE_TOKEN_TTL_SECONDS must be between 1 and 60.")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
