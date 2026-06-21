"""Supabase client initialization.

Provides a single shared Supabase client and a `get_db()` accessor used by
routers and services. The client is created once at import time from the
validated application settings.
"""

import logging

from supabase import Client, create_client

from core.config import settings

logger = logging.getLogger(__name__)

_supabase: Client | None = None


def _init_client() -> Client:
    """Create the Supabase client from configuration.

    Wrapped in try/except so a connection/credentials problem produces a
    clear log line at startup instead of an opaque traceback later.
    """
    try:
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("Supabase client initialized")
        return client
    except Exception:  # noqa: BLE001 - surface any init failure loudly
        logger.exception("Failed to initialize Supabase client")
        raise


_supabase = _init_client()


def get_db() -> Client:
    """Return the shared Supabase client.

    Usable as a FastAPI dependency: `db: Client = Depends(get_db)`.
    """
    if _supabase is None:  # pragma: no cover - defensive
        raise RuntimeError("Supabase client is not initialized")
    return _supabase
