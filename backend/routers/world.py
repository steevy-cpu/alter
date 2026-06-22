"""World router.

Endpoints exposing shared world state (current game day, active agents count)
and public per-agent relationship data for future multiplayer viewing.
"""

import logging

from fastapi import APIRouter

from core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status")
async def get_world_status() -> dict:
    """Return the shared world state queried from the world_state table."""
    try:
        db = get_db()
        world_res = db.table("world_state").select("*").limit(1).execute()
        if not world_res.data:
            return {"current_game_day": 1, "active_agents": 0, "last_tick": None}

        world = world_res.data[0]

        agents_res = db.table("agents").select("id").eq("is_active", True).execute()
        active_count = len(agents_res.data or [])

        return {
            "current_game_day": world.get("current_game_day", 1),
            "active_agents": active_count,
            "last_tick": world.get("last_tick"),
        }
    except Exception:  # noqa: BLE001
        logger.exception("get_world_status failed")
        return {"current_game_day": 1, "active_agents": 0, "last_tick": None}


@router.get("/relationships/{agent_id}")
async def get_agent_relationships(agent_id: str) -> list:
    """Return public relationships for an agent, ordered by strength DESC."""
    try:
        db = get_db()
        res = (
            db.table("relationships")
            .select("npc_name, relationship_type, strength, summary")
            .eq("agent_id", agent_id)
            .order("strength", desc=True)
            .limit(10)
            .execute()
        )
        return res.data or []
    except Exception:  # noqa: BLE001
        logger.exception("get_agent_relationships failed for agent_id=%s", agent_id)
        return []
