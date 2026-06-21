"""Agent memory Pydantic models.

Mirrors `public.agent_memories`. Memories carry an optional vector embedding
used for semantic retrieval during planning and decision making.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

MemoryType = Literal["event", "reflection", "relationship", "goal", "lesson"]


class MemoryCreate(BaseModel):
    """A memory to be stored for an agent."""

    agent_id: str
    content: str
    memory_type: MemoryType
    emotional_weight: float = Field(default=0.5, ge=0.0, le=1.0)
    embedding: list[float] | None = None
    game_day: int


class Memory(MemoryCreate):
    """A persisted memory row."""

    id: str
    created_at: datetime | None = None
