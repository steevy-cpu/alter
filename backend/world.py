"""
world.py — Spatial model for the Alter 3D world.

This module is the single source of truth for *where things are* in the city
and *what an Alter can do* there. It is intentionally framework-free (no FastAPI
imports) so it can be unit-tested and reused by the simulation tick.

Coordinate system matches the exported `alter_city.glb`:
  - The Blender export used Y-up (for three.js), so in the browser the ground
    plane is X / Z and "up" is Y. To keep the Python side simple and engine-
    agnostic, we store ground positions as (x, z) pairs — the two horizontal
    axes — and let the frontend map them onto the three.js ground plane.
  - City spans roughly -74..+74 on both horizontal axes.
  - Block centers sit at -56, -28, 0, +28, +56.
  - The park is the center block, centered on the origin.
  - The ocean/beach is to the +X (east) side, beyond x = +74.

If you re-export the city with a different layout, update LOCATIONS below.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional
import math


# ---------------------------------------------------------------------------
# Named locations an Alter can navigate to. Ground coordinates are (x, z),
# the two horizontal axes of the three.js scene.
# ---------------------------------------------------------------------------

LOCATIONS: dict[str, tuple[float, float]] = {
    "home":          (-56.0, -56.0),  # SW block — Steeve's apartment building
    "park_center":   (0.0, 0.0),      # fountain, middle of the central park
    "park_bench":    (1.5, 3.0),      # a seat by the pond
    "park_table":    (-4.0, -4.0),    # café-style table cluster in the park
    "cafe":          (28.0, -28.0),   # a shop block
    "office":        (-28.0, 28.0),   # a mid-rise where Steeve "works"
    "bookshop":      (28.0, 28.0),
    "beach":         (82.0, 0.0),     # sandy strip by the ocean
    "plaza_corner":  (-28.0, -28.0),
}

# Locations that are "sittable" — arriving here can transition to a Sit action.
SITTABLE = {"park_bench", "park_table", "cafe", "home", "office"}


class Action(str, Enum):
    """High-level actions the AI can choose. The frontend maps these to
    animation clips + movement; the backend never sets bone rotations."""
    IDLE = "idle"          # stand / breathe in place
    WALK_TO = "walk_to"    # travel to a named location (requires `target`)
    SIT = "sit"            # sit down at the current location
    STAND = "stand"        # stand back up from sitting


# The exact vocabulary handed to Claude as a tool / structured-output schema.
# Keeping it here means the prompt and the simulation share one definition.
ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": [a.value for a in Action],
            "description": "What Steeve does next.",
        },
        "target": {
            "type": ["string", "null"],
            "enum": list(LOCATIONS.keys()) + [None],
            "description": "Destination for walk_to; null otherwise.",
        },
        "reason": {
            "type": "string",
            "description": "One short sentence: why Steeve chose this, in his voice.",
        },
    },
    "required": ["action", "reason"],
}


@dataclass
class AlterState:
    """Everything the frontend needs to render and animate one Alter.
    Streamed as-is over the WebSocket each tick."""
    id: str
    name: str
    x: float = LOCATIONS["home"][0]
    z: float = LOCATIONS["home"][1]
    facing: float = 0.0            # yaw in radians
    action: str = Action.IDLE.value
    anim: str = "Idle"             # animation clip name in the .glb
    target: Optional[str] = None   # named destination, if walking
    target_x: Optional[float] = None
    target_z: Optional[float] = None
    speed: float = 2.2             # metres per second while walking
    reason: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


def resolve_action(state: AlterState, action: str, target: Optional[str], reason: str) -> AlterState:
    """Apply a chosen high-level action to an Alter's state.

    This sets *intent* (target + animation). The per-tick movement toward the
    target is done by `advance` so motion is smooth regardless of how often the
    AI is consulted.
    """
    state.reason = reason or ""

    if action == Action.WALK_TO.value:
        if target not in LOCATIONS:
            # Unknown destination -> ignore, stay idle rather than teleport.
            state.action = Action.IDLE.value
            state.anim = "Idle"
            state.target = None
            state.target_x = state.target_z = None
            return state
        tx, tz = LOCATIONS[target]
        state.action = Action.WALK_TO.value
        state.anim = "Walk"
        state.target = target
        state.target_x, state.target_z = tx, tz
        state.facing = math.atan2(tx - state.x, tz - state.z)

    elif action == Action.SIT.value:
        state.action = Action.SIT.value
        state.anim = "Sit"
        state.target = None
        state.target_x = state.target_z = None

    elif action == Action.STAND.value:
        state.action = Action.IDLE.value
        state.anim = "Idle"

    else:  # IDLE or anything unrecognised
        state.action = Action.IDLE.value
        state.anim = "Idle"
        state.target = None
        state.target_x = state.target_z = None

    return state


def advance(state: AlterState, dt: float) -> AlterState:
    """Move an Alter toward its target by dt seconds. Call every tick.

    When the Alter reaches a sittable destination it auto-transitions to Sit;
    otherwise it falls back to Idle on arrival.
    """
    if state.action != Action.WALK_TO.value or state.target_x is None:
        return state

    dx = state.target_x - state.x
    dz = state.target_z - state.z
    dist = math.hypot(dx, dz)
    step = state.speed * dt

    if dist <= step or dist < 1e-3:
        # Arrived.
        state.x, state.z = state.target_x, state.target_z
        arrived_at = state.target
        state.target = None
        state.target_x = state.target_z = None
        if arrived_at in SITTABLE:
            state.action = Action.SIT.value
            state.anim = "Sit"
        else:
            state.action = Action.IDLE.value
            state.anim = "Idle"
    else:
        state.x += dx / dist * step
        state.z += dz / dist * step
        state.facing = math.atan2(dx, dz)

    return state
