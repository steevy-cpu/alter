"""Agent (the user's AI self) Pydantic models.

Mirrors `public.agents` and `public.agent_state`.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class AgentProfileCreate(BaseModel):
    """Full life profile submitted from onboarding to create an agent."""

    # Step 1 — Identity
    name: str
    age: int | None = Field(default=None, ge=0, le=130)
    city: str | None = None
    occupation: str | None = None

    # Step 2 — Personality
    personality_description: str | None = None
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)

    # Step 3 — Life
    goals: str | None = None
    fears: str | None = None
    habits: str | None = None

    # Step 4 — Future
    career_direction: str | None = None
    relationship_goals: str | None = None
    desired_future: str | None = None


class Agent(AgentProfileCreate):
    """A persisted agent row."""

    id: str
    user_id: str
    is_active: bool = True
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AgentState(BaseModel):
    """The agent's emotional state, updated every tick."""

    agent_id: str
    energy: int = Field(default=75, ge=0, le=100)
    happiness: int = Field(default=70, ge=0, le=100)
    stress: int = Field(default=30, ge=0, le=100)
    motivation: int = Field(default=80, ge=0, le=100)
    loneliness: int = Field(default=40, ge=0, le=100)
    current_focus: str | None = None
    last_updated: datetime | None = None
