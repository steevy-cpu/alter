"""World / game-event Pydantic models.

Mirrors `public.game_events`, `public.npcs`, and `public.world_state`.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

EventType = Literal[
    "daily_narrative",
    "cross_player",
    "goal_update",
    "relationship_event",
    "reflection",
    "world_event",
]


class GameEvent(BaseModel):
    """A single entry in an agent's narrative feed."""

    id: str | None = None
    agent_id: str
    event_type: EventType
    title: str | None = None
    content: str
    metadata: dict = Field(default_factory=dict)
    game_day: int
    is_public: bool = False
    created_at: datetime | None = None


class NPC(BaseModel):
    """A shared-world non-player character."""

    id: str | None = None
    name: str
    personality: str | None = None
    occupation: str | None = None
    city: str | None = None
    is_global: bool = False
    created_at: datetime | None = None


class WorldState(BaseModel):
    """Global shared world state."""

    id: str | None = None
    current_game_day: int = 1
    active_agents: int = 0
    last_tick: datetime | None = None
    world_events: list[dict] = Field(default_factory=list)
