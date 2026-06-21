"""Agent router.

Endpoints for creating and reading the user's AI self (agent) and its
emotional state. Stubs establish the API contract used by the frontend.
"""

import logging

from fastapi import APIRouter, HTTPException

from core.database import get_db
from models.agent import AgentProfileCreate

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/create")
async def create_agent(profile: AgentProfileCreate) -> dict:
    """Create the user's agent from the onboarding life profile (stub).

    Will insert into `agents`, seed a default `agent_state` row, and write an
    initial 'birth' memory.
    """
    db = get_db()
    try:
        logger.info("create_agent requested for name=%s", profile.name)
        # TODO: insert agent + default state, return created row.
        return {"status": "stub", "received": profile.model_dump()}
    except Exception as exc:  # noqa: BLE001
        logger.exception("create_agent failed")
        raise HTTPException(status_code=500, detail="create_agent failed") from exc


@router.get("/")
async def get_agent() -> dict:
    """Return the current user's agent and emotional state (stub)."""
    return {"status": "stub", "detail": "get_agent not yet implemented"}
