"""World router.

Endpoints exposing shared world state (current game day, active agents) and
public world events. Stubs for now.
"""

import logging

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status")
async def get_world_status() -> dict:
    """Return the shared world state (stub)."""
    return {
        "status": "stub",
        "current_game_day": 1,
        "active_agents": 0,
    }
