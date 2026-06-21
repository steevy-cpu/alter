"""Simulation router (Phase 1).

Exposes the narrative event feed for the current user's agent. Returns only
`game_events` rows (never agent_memories — those are a separate table and stay
private to the simulation engine).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException

from core.database import get_db
from routers.agent import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/feed")
async def get_event_feed(
    limit: int = 50, user_id: str = Depends(get_current_user)
) -> list[dict]:
    """Return the most recent game_events for the current user's agent."""
    db = get_db()
    try:
        agent_res = (
            db.table("agents").select("id").eq("user_id", user_id).limit(1).execute()
        )
        if not agent_res.data:
            return []
        agent_id = agent_res.data[0]["id"]

        feed_res = (
            db.table("game_events")
            .select("*")
            .eq("agent_id", agent_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return feed_res.data or []
    except Exception as exc:  # noqa: BLE001
        logger.exception("get_event_feed failed for user=%s", user_id)
        raise HTTPException(status_code=500, detail="get_event_feed failed") from exc
