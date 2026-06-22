"""Alter API — application entrypoint.

Creates the FastAPI app, wires CORS, mounts all routers, exposes the
per-user WebSocket endpoint and a health check, and manages the simulation
tick scheduler lifecycle via the lifespan context.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.database import get_db
from core.websocket_manager import manager
from routers import agent, auth, simulation, world
from simulation.tick_scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("alter")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the tick scheduler on startup, stop it on shutdown."""
    logger.info("Starting Alter API (environment=%s)", settings.ENVIRONMENT)
    start_scheduler()
    try:
        yield
    finally:
        stop_scheduler()
        logger.info("Alter API shut down")


app = FastAPI(title="Alter API", lifespan=lifespan)

# CORS — only allow the specific configured frontend origin (never wildcard).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(agent.router, prefix="/agent", tags=["agent"])
app.include_router(simulation.router, prefix="/simulation", tags=["simulation"])
app.include_router(world.router, prefix="/world", tags=["world"])


@app.get("/")
async def health_check() -> dict:
    """Health check endpoint used by Railway and uptime monitors."""
    return {"status": "alive", "game": "Alter"}


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    token: str = None,
) -> None:
    """Per-user real-time channel.

    The client connects once after auth; the simulation loop pushes small
    JSON deltas (events, emotional state, relationships) to this socket.
    If a token query parameter is present it is verified against Supabase —
    mismatched or invalid tokens close the socket with code 4001.
    """
    if token:
        db = get_db()
        try:
            result = db.auth.get_user(token)
            auth_user = getattr(result, "user", None)
            auth_user_id = getattr(auth_user, "id", None)
            if auth_user_id != user_id:
                await websocket.close(code=4001)
                return
        except Exception:  # noqa: BLE001
            logger.warning("WebSocket token verification failed for user=%s", user_id)
            await websocket.close(code=4001)
            return

    await manager.connect(websocket, user_id)
    try:
        while True:
            # We mostly push server -> client, but keep the socket alive and
            # accept optional client pings/messages here.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception:  # noqa: BLE001
        logger.exception("WebSocket error for user=%s", user_id)
        manager.disconnect(user_id)
