"""WebSocket connection manager.

Tracks one active WebSocket per connected user and provides helpers to send
JSON messages to a single user, broadcast to everyone, or broadcast to
everyone except one user. All payloads are serialized to JSON; keep them
small — never push large blobs over the socket.
"""

import json
import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections keyed by user id."""

    def __init__(self) -> None:
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        """Accept a new connection and register it for `user_id`.

        If the user already had a socket open, it is replaced.
        """
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info("WebSocket connected: user=%s (total=%d)", user_id, len(self.active_connections))

    def disconnect(self, user_id: str) -> None:
        """Remove a user's connection from the registry."""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info("WebSocket disconnected: user=%s (total=%d)", user_id, len(self.active_connections))

    async def send_to_user(self, user_id: str, message_dict: dict) -> None:
        """Send a JSON message to a single user if connected."""
        websocket = self.active_connections.get(user_id)
        if websocket is None:
            return
        try:
            await websocket.send_text(json.dumps(message_dict))
        except Exception:  # noqa: BLE001 - drop dead sockets gracefully
            logger.warning("Failed to send to user=%s; dropping connection", user_id)
            self.disconnect(user_id)

    async def broadcast(self, message_dict: dict) -> None:
        """Send a JSON message to every connected user."""
        payload = json.dumps(message_dict)
        for user_id, websocket in list(self.active_connections.items()):
            try:
                await websocket.send_text(payload)
            except Exception:  # noqa: BLE001
                logger.warning("Broadcast failed for user=%s; dropping", user_id)
                self.disconnect(user_id)

    async def broadcast_except(self, user_id: str, message_dict: dict) -> None:
        """Broadcast to all connected users except `user_id`."""
        payload = json.dumps(message_dict)
        for uid, websocket in list(self.active_connections.items()):
            if uid == user_id:
                continue
            try:
                await websocket.send_text(payload)
            except Exception:  # noqa: BLE001
                logger.warning("Broadcast(except) failed for user=%s; dropping", uid)
                self.disconnect(uid)


# Shared singleton used across routers and the simulation loop.
manager = ConnectionManager()
