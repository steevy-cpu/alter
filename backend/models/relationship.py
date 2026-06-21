"""Relationship Pydantic models.

Mirrors `public.relationships`. Tracks an agent's bond to another agent or an
NPC, including type and strength.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

TargetType = Literal["agent", "npc"]
RelationshipType = Literal[
    "friend",
    "rival",
    "romantic",
    "colleague",
    "family",
    "acquaintance",
    "stranger",
]


class Relationship(BaseModel):
    """A relationship row between an agent and a target."""

    id: str | None = None
    agent_id: str
    target_id: str
    target_type: TargetType
    relationship_type: RelationshipType = "stranger"
    strength: int = Field(default=10, ge=0, le=100)
    summary: str | None = None
    last_interaction: datetime | None = None
    created_at: datetime | None = None
