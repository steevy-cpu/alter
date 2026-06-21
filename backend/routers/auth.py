"""Auth router.

Handles signup, login, and session lookup against Supabase Auth. These are
stubs that establish the contract; the Supabase calls will be filled in.
"""

import logging

from fastapi import APIRouter, HTTPException

from core.database import get_db
from models.user import AuthResponse, UserCredentials

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/signup", response_model=AuthResponse)
async def signup(credentials: UserCredentials) -> AuthResponse:
    """Register a new user via Supabase Auth (stub)."""
    db = get_db()
    try:
        # TODO: db.auth.sign_up({...}) and create a profiles row.
        logger.info("signup requested for %s", credentials.email)
        raise HTTPException(status_code=501, detail="signup not yet implemented")
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("signup failed")
        raise HTTPException(status_code=500, detail="signup failed") from exc


@router.post("/login", response_model=AuthResponse)
async def login(credentials: UserCredentials) -> AuthResponse:
    """Authenticate an existing user via Supabase Auth (stub)."""
    db = get_db()
    try:
        # TODO: db.auth.sign_in_with_password({...}).
        logger.info("login requested for %s", credentials.email)
        raise HTTPException(status_code=501, detail="login not yet implemented")
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("login failed")
        raise HTTPException(status_code=500, detail="login failed") from exc


@router.get("/me")
async def me() -> dict:
    """Return the current authenticated user's profile (stub)."""
    return {"status": "stub", "detail": "current user lookup not yet implemented"}
