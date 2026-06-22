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
    """Return the most recent individual event rows for the user's agent.

    Only returns rows with event_type = "daily_narrative" (the individual
    event cards). The per-day "day_summary" master row — which holds the large
    narrative blob and full metadata — is excluded from the feed.
    """
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
            .eq("event_type", "daily_narrative")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return feed_res.data or []
    except Exception as exc:  # noqa: BLE001
        logger.exception("get_event_feed failed for user=%s", user_id)
        raise HTTPException(status_code=500, detail="get_event_feed failed") from exc


@router.get("/memories")
async def get_memories(
    limit: int = 20, user_id: str = Depends(get_current_user)
) -> list[dict]:
    """Return the most recent agent memories for the current user's agent."""
    db = get_db()
    try:
        agent_res = (
            db.table("agents").select("id").eq("user_id", user_id).limit(1).execute()
        )
        if not agent_res.data:
            return []
        agent_id = agent_res.data[0]["id"]

        mem_res = (
            db.table("agent_memories")
            .select("id, content, memory_type, game_day, emotional_weight, created_at")
            .eq("agent_id", agent_id)
            .order("game_day", desc=True)
            .limit(limit)
            .execute()
        )
        return mem_res.data or []
    except Exception:  # noqa: BLE001
        logger.exception("get_memories failed for user=%s", user_id)
        return []


@router.get("/day-summary/{game_day}")
async def get_day_summary(
    game_day: int, user_id: str = Depends(get_current_user)
) -> dict:
    """Return the single day_summary row for a given game_day.

    Used by the reflection panel. Returns 404 if no summary exists for that
    day for the current user's agent.
    """
    db = get_db()
    try:
        agent_res = (
            db.table("agents").select("id").eq("user_id", user_id).limit(1).execute()
        )
        if not agent_res.data:
            raise HTTPException(status_code=404, detail="No agent found")
        agent_id = agent_res.data[0]["id"]

        summary_res = (
            db.table("game_events")
            .select("*")
            .eq("agent_id", agent_id)
            .eq("event_type", "day_summary")
            .eq("game_day", game_day)
            .limit(1)
            .execute()
        )
        if not summary_res.data:
            raise HTTPException(status_code=404, detail="No day summary for that day")
        return summary_res.data[0]
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("get_day_summary failed for user=%s day=%s", user_id, game_day)
        raise HTTPException(status_code=500, detail="get_day_summary failed") from exc
