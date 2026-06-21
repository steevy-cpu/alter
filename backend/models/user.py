"""User / profile Pydantic models.

Mirrors the `public.profiles` table and the auth request/response shapes used
by the auth router.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCredentials(BaseModel):
    """Login / signup payload."""

    email: EmailStr
    password: str = Field(min_length=8)


class Profile(BaseModel):
    """A user profile row (extends Supabase auth.users)."""

    id: str
    username: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AuthResponse(BaseModel):
    """Returned after a successful login/signup."""

    access_token: str
    user_id: str
    is_new_user: bool = False
