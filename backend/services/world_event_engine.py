"""World event engine.

Generates the events that happen to agents each day and detects when two
agents' lives should intersect (cross-player events). Stub for now.
"""

import logging

logger = logging.getLogger(__name__)


class WorldEventEngine:
    """Generates per-agent and cross-player world events."""

    async def generate_events(self, agent_profile: dict, game_day: int) -> list[dict]:
        """Generate 1-3 events that happen to the agent today (stub)."""
        logger.info(
            "generate_events: agent=%s day=%d",
            agent_profile.get("name"),
            game_day,
        )
        return []

    async def find_cross_player_interactions(self, game_day: int) -> list[dict]:
        """Detect which agents should interact this tick (stub)."""
        logger.info("find_cross_player_interactions: day=%d", game_day)
        return []
