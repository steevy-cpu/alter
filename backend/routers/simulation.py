"""Simulation router.

Endpoints to read the narrative event feed and (in development) manually
trigger a simulation tick. Stubs for now.
"""

import logging

from fastapi import APIRouter, HTTPException

from simulation.daily_loop import run_tick

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/feed")
async def get_event_feed() -> dict:
    """Return the agent's narrative event feed (stub)."""
    return {"status": "stub", "events": []}


@router.post("/tick")
async def manual_tick() -> dict:
    """Manually run one simulation tick (dev/testing helper)."""
    try:
        await run_tick()
        return {"status": "ok", "detail": "tick executed"}
    except Exception as exc:  # noqa: BLE001
        logger.exception("manual tick failed")
        raise HTTPException(status_code=500, detail="tick failed") from exc
