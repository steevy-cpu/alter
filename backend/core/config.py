"""Application configuration.

Loads and validates all environment variables at import time using
pydantic-settings. If a required variable is missing the app fails fast
on startup (see `settings = Settings()` below) rather than crashing later
deep inside a request handler.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed application settings sourced from the environment."""

    # --- Required (no defaults — startup fails if absent) ---
    SUPABASE_URL: str
    SUPABASE_KEY: str
    ANTHROPIC_API_KEY: str
    FRONTEND_URL: str
    SECRET_KEY: str

    # --- Optional (sensible defaults) ---
    TICK_INTERVAL_SECONDS: int = 30
    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance.

    Validation happens on first call. Any missing required variable raises a
    pydantic ValidationError, which surfaces immediately at startup.
    """
    return Settings()


# Eagerly instantiate so misconfiguration fails fast at import/startup time.
settings = get_settings()
