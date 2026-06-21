"""Agent router (Phase 1).

Creates the user's AI self and exposes its profile + emotional state. Auth is
enforced by verifying the Supabase JWT on every request via get_current_user.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.database import get_db

logger = logging.getLogger(__name__)

# prefix is applied in main.py (include_router(prefix="/agent"))
router = APIRouter()


# --- Request model ---------------------------------------------------------
class AgentCreateRequest(BaseModel):
    name: str
    age: int
    city: str
    occupation: str
    personality_description: str
    strengths: list[str]
    weaknesses: list[str]
    goals: str
    fears: str
    habits: str
    career_direction: str
    relationship_goals: str
    desired_future: str


# --- Auth dependency -------------------------------------------------------
def get_current_user(request: Request) -> str:
    """Resolve the Supabase user id from the Authorization header.

    Expects "Authorization: Bearer <supabase_jwt>". Verifies the token with
    Supabase and returns the user id string. Raises 401 if missing/invalid.
    """
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty bearer token")

    db = get_db()
    try:
        result = db.auth.get_user(token)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Supabase token verification failed")
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    user = getattr(result, "user", None)
    user_id = getattr(user, "id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: no user")
    return user_id


# --- Endpoints -------------------------------------------------------------
@router.post("/create")
async def create_agent(
    payload: AgentCreateRequest, user_id: str = Depends(get_current_user)
) -> dict:
    """Create the user's agent + default emotional state.

    Returns 409 if the user already has an agent.
    """
    db = get_db()
    try:
        existing = (
            db.table("agents").select("id").eq("user_id", user_id).limit(1).execute()
        )
        if existing.data:
            raise HTTPException(status_code=409, detail="Agent already exists for this user")

        # Ensure a profiles row exists first. agents.user_id has a FK to
        # profiles(id), but Supabase Auth signup does not create a profiles
        # row, so we upsert one here (idempotent).
        db.table("profiles").upsert({"id": user_id}).execute()

        agent_row = {"user_id": user_id, **payload.model_dump()}
        inserted = db.table("agents").insert(agent_row).execute()
        if not inserted.data:
            raise HTTPException(status_code=500, detail="Failed to create agent")

        agent_id = inserted.data[0]["id"]

        # Seed default emotional state.
        db.table("agent_state").insert(
            {
                "agent_id": agent_id,
                "energy": 75,
                "happiness": 70,
                "stress": 30,
                "motivation": 80,
                "loneliness": 40,
            }
        ).execute()

        return {"agent_id": agent_id, "message": "Your Alter is ready"}
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("create_agent failed for user=%s", user_id)
        raise HTTPException(status_code=500, detail="create_agent failed") from exc


@router.get("/me")
async def get_me(user_id: str = Depends(get_current_user)) -> dict:
    """Return the user's agent joined with its emotional state. 404 if none."""
    db = get_db()
    try:
        agent_res = (
            db.table("agents").select("*").eq("user_id", user_id).limit(1).execute()
        )
        if not agent_res.data:
            raise HTTPException(status_code=404, detail="No agent found")

        agent = agent_res.data[0]
        state_res = (
            db.table("agent_state").select("*").eq("agent_id", agent["id"]).limit(1).execute()
        )
        agent["state"] = state_res.data[0] if state_res.data else None
        return agent
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("get_me failed for user=%s", user_id)
        raise HTTPException(status_code=500, detail="get_me failed") from exc


@router.get("/state")
async def get_state(user_id: str = Depends(get_current_user)) -> dict:
    """Return only the current agent_state row for the user. 404 if none."""
    db = get_db()
    try:
        agent_res = (
            db.table("agents").select("id").eq("user_id", user_id).limit(1).execute()
        )
        if not agent_res.data:
            raise HTTPException(status_code=404, detail="No agent found")

        agent_id = agent_res.data[0]["id"]
        state_res = (
            db.table("agent_state").select("*").eq("agent_id", agent_id).limit(1).execute()
        )
        if not state_res.data:
            raise HTTPException(status_code=404, detail="No agent state found")
        return state_res.data[0]
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("get_state failed for user=%s", user_id)
        raise HTTPException(status_code=500, detail="get_state failed") from exc
