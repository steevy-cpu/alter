"""
sim_router.py — FastAPI router wiring the world + brain into your app.

Drop-in for the Alter backend. It:
  - keeps one AlterState for Steeve (the test player),
  - runs a fixed-interval tick that moves him toward his target,
  - every Nth tick, asks Claude (brain.decide_next_action) for a new action,
  - streams the state to any connected WebSocket clients each tick.

Integration in main.py:

    from sim_router import router as sim_router, start_sim, stop_sim

    app.include_router(sim_router)

    @app.on_event("startup")
    async def _startup():
        await start_sim()

    @app.on_event("shutdown")
    async def _shutdown():
        await stop_sim()

Frontend connects to:  ws://<host>/ws/world
and GETs the static glb files you copy into the frontend (see README).

This uses asyncio rather than APScheduler so it can `await` the Anthropic call
cleanly; if you prefer APScheduler (already in your stack) the tick body is the
same — call `_tick()` from the scheduled job.
"""

from __future__ import annotations
import asyncio
import os
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from world import AlterState, advance, resolve_action, LOCATIONS
from brain import decide_next_action

router = APIRouter()

# ---- single test player for now: Steeve ----
steeve = AlterState(id="steeve", name="Steeve")
_recent_actions: list[str] = []

# NOTE: this is the *world movement* tick (smooth 3D motion), distinct from the
# existing daily-life sim which uses TICK_INTERVAL_SECONDS (=30s). It has its own
# env var so the two cadences never collide.
TICK_SECONDS = float(os.environ.get("WORLD_TICK_SECONDS", "0.1"))     # smooth motion
DECISION_EVERY = int(os.environ.get("DECISION_EVERY_TICKS", "80"))    # ~ every 8s at 0.1s
PERSONA = os.environ.get(
    "STEEVE_PERSONA",
    "Steeve, a thoughtful 28-year-old who loves the park, coffee, and the sea",
)

_clients: Set[WebSocket] = set()
_task: asyncio.Task | None = None
_tick_count = 0


async def _broadcast() -> None:
    if not _clients:
        return
    payload = {"type": "alter_state", "alter": steeve.to_dict()}
    dead = []
    for ws in _clients:
        try:
            await ws.send_json(payload)
        except Exception:  # noqa: BLE001
            dead.append(ws)
    for ws in dead:
        _clients.discard(ws)


async def _tick() -> None:
    global _tick_count
    _tick_count += 1

    # 1) Ask the AI for a new high-level action periodically (or when idle and free).
    if _tick_count % DECISION_EVERY == 0:
        decision = await decide_next_action(steeve, PERSONA, _recent_actions)
        resolve_action(steeve, decision["action"], decision.get("target"), decision.get("reason", ""))
        label = decision["action"] + (f"->{decision['target']}" if decision.get("target") else "")
        _recent_actions.append(label)
        del _recent_actions[:-12]  # keep last 12

    # 2) Advance movement smoothly every tick.
    advance(steeve, TICK_SECONDS)

    # 3) Stream to clients.
    await _broadcast()


def seed_steeve() -> None:
    """Give Steeve a first goal so something happens immediately.

    Called once when the world tick is registered on the shared APScheduler
    (the integration path used here). The asyncio `_loop()` below does the same
    seeding inline for the alternative `start_sim()` path.
    """
    resolve_action(steeve, "walk_to", "park_bench", "Heading out to enjoy the park.")
    if "walk_to->park_bench" not in _recent_actions:
        _recent_actions.append("walk_to->park_bench")


async def _loop() -> None:
    # Give Steeve a first goal so something happens immediately.
    resolve_action(steeve, "walk_to", "park_bench", "Heading out to enjoy the park.")
    _recent_actions.append("walk_to->park_bench")
    while True:
        try:
            await _tick()
        except Exception:  # noqa: BLE001 — never let the loop die
            pass
        await asyncio.sleep(TICK_SECONDS)


async def start_sim() -> None:
    global _task
    if _task is None:
        _task = asyncio.create_task(_loop())


async def stop_sim() -> None:
    global _task
    if _task:
        _task.cancel()
        _task = None


@router.get("/api/world/locations")
async def get_locations():
    """Named destinations + coordinates, handy for the frontend to draw labels."""
    return {"locations": {k: {"x": v[0], "z": v[1]} for k, v in LOCATIONS.items()}}


@router.get("/api/world/steeve")
async def get_steeve():
    return steeve.to_dict()


@router.websocket("/ws/world")
async def ws_world(ws: WebSocket):
    await ws.accept()
    _clients.add(ws)
    # send an immediate snapshot so the client can place Steeve at once
    await ws.send_json({"type": "alter_state", "alter": steeve.to_dict()})
    try:
        while True:
            # We don't expect inbound messages, but keep the socket alive and
            # allow a manual override for testing: {"action": "...", "target": "..."}
            msg = await ws.receive_json()
            if isinstance(msg, dict) and "action" in msg:
                resolve_action(steeve, msg["action"], msg.get("target"), msg.get("reason", "manual"))
    except WebSocketDisconnect:
        _clients.discard(ws)
    except Exception:  # noqa: BLE001
        _clients.discard(ws)
