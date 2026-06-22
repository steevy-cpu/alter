"""NPC service — generates and manages NPC characters for an agent."""

import json
import logging
from datetime import datetime, timezone

from core.database import get_db

logger = logging.getLogger(__name__)

MODEL = "claude-haiku-4-5-20251001"


class NpcService:
    def __init__(self, anthropic_client) -> None:
        self.client = anthropic_client
        self.db = get_db()

    async def generate_npcs_for_agent(
        self,
        agent_id: str,
        agent_profile: dict,
    ) -> list[dict]:
        """Generate 4-6 NPC characters seeded from the agent's life profile.

        Called once when the agent is first created (via BackgroundTasks).
        If relationships already exist for this agent, returns [] immediately.
        Never raises.
        """
        try:
            existing = (
                self.db.table("relationships")
                .select("id")
                .eq("agent_id", agent_id)
                .limit(1)
                .execute()
            )
            if existing.data:
                return []
        except Exception:  # noqa: BLE001
            logger.exception("generate_npcs_for_agent: existence check failed agent=%s", agent_id)
            return []

        system = (
            "You generate realistic supporting characters for a life simulation. "
            "Given a person's profile, create 4-6 people who would naturally exist "
            "in their life. Be specific with names and personalities. "
            "Return ONLY valid JSON, no explanation."
        )
        user = f"""Create 4-6 NPCs for this person's life:

Name: {agent_profile.get('name')}
Age: {agent_profile.get('age')}
City: {agent_profile.get('city')}
Occupation: {agent_profile.get('occupation')}
Personality: {agent_profile.get('personality_description')}
Goals: {agent_profile.get('goals')}
Relationship goals: {agent_profile.get('relationship_goals')}

Return a JSON array of NPCs. Each NPC:
{{
  "name": "first and last name",
  "personality": "2 sentences describing who they are",
  "occupation": "what they do",
  "city": "{agent_profile.get('city')}",
  "relationship_type": "friend | colleague | family | acquaintance | romantic",
  "initial_strength": 20 to 60,
  "summary": "one sentence: how they know the agent"
}}"""

        try:
            response = await self.client.messages.create(
                model=MODEL,
                max_tokens=1500,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            text = next((b.text for b in response.content if b.type == "text"), "")
            cleaned = text.strip()
            if cleaned.startswith("```"):
                parts = cleaned.split("```")
                cleaned = parts[1] if len(parts) > 1 else cleaned
                if cleaned.lstrip().lower().startswith("json"):
                    cleaned = cleaned.lstrip()[4:]
            cleaned = cleaned.strip()
            npcs_data = json.loads(cleaned)
            if not isinstance(npcs_data, list):
                raise ValueError("expected list")
        except Exception:  # noqa: BLE001
            logger.exception("generate_npcs_for_agent LLM call failed; using defaults agent=%s", agent_id)
            npcs_data = [
                {
                    "name": "Alex Rivera",
                    "personality": "Energetic and supportive. Always ready to help.",
                    "occupation": "Software developer",
                    "city": agent_profile.get("city", "Miami"),
                    "relationship_type": "friend",
                    "initial_strength": 45,
                    "summary": "A close friend who shares similar interests.",
                },
                {
                    "name": "Sam Chen",
                    "personality": "Thoughtful and analytical. Gives good advice.",
                    "occupation": "Graduate student",
                    "city": agent_profile.get("city", "Miami"),
                    "relationship_type": "colleague",
                    "initial_strength": 35,
                    "summary": "A colleague met through shared work or study.",
                },
                {
                    "name": "Jordan Williams",
                    "personality": "Creative and spontaneous. Brings lightness.",
                    "occupation": "Designer",
                    "city": agent_profile.get("city", "Miami"),
                    "relationship_type": "acquaintance",
                    "initial_strength": 25,
                    "summary": "Someone from the neighborhood or local scene.",
                },
            ]

        created = []
        for npc_data in npcs_data:
            try:
                npc_res = (
                    self.db.table("npcs")
                    .insert(
                        {
                            "name": npc_data.get("name"),
                            "personality": npc_data.get("personality"),
                            "occupation": npc_data.get("occupation"),
                            "city": npc_data.get("city", agent_profile.get("city")),
                            "is_global": False,
                        }
                    )
                    .execute()
                )
                if not npc_res.data:
                    continue
                npc_id = npc_res.data[0]["id"]

                self.db.table("relationships").insert(
                    {
                        "agent_id": agent_id,
                        "target_id": npc_id,
                        "target_type": "npc",
                        "relationship_type": npc_data.get("relationship_type", "acquaintance"),
                        "strength": npc_data.get("initial_strength", 30),
                        "summary": npc_data.get("summary", ""),
                        "npc_name": npc_data.get("name"),
                        "npc_personality": npc_data.get("personality"),
                        "npc_occupation": npc_data.get("occupation"),
                    }
                ).execute()

                created.append(
                    {
                        "npc_id": npc_id,
                        "name": npc_data.get("name"),
                        "relationship_type": npc_data.get("relationship_type"),
                        "strength": npc_data.get("initial_strength", 30),
                    }
                )
            except Exception:  # noqa: BLE001
                logger.exception("Failed to insert NPC: %s", npc_data.get("name"))

        logger.info("Generated %d NPCs for agent=%s", len(created), agent_id)
        return created

    async def get_agent_relationships(self, agent_id: str) -> list[dict]:
        """Fetch current relationships for an agent, ordered by strength. Returns [] on failure."""
        try:
            res = (
                self.db.table("relationships")
                .select("*")
                .eq("agent_id", agent_id)
                .order("strength", desc=True)
                .limit(10)
                .execute()
            )
            return res.data or []
        except Exception:  # noqa: BLE001
            logger.exception("get_agent_relationships failed for agent=%s", agent_id)
            return []

    async def update_relationship_from_event(
        self,
        agent_id: str,
        npc_name: str,
        event_description: str,
        emotional_impact: dict,
    ) -> None:
        """Update relationship strength when an NPC appears in an event.

        Adjusts strength based on happiness + loneliness impact from the event.
        Never raises.
        """
        try:
            rel_res = (
                self.db.table("relationships")
                .select("*")
                .eq("agent_id", agent_id)
                .eq("npc_name", npc_name)
                .limit(1)
                .execute()
            )
            if not rel_res.data:
                return

            rel = rel_res.data[0]
            current_strength = rel.get("strength", 30)

            happiness_delta = emotional_impact.get("happiness", 0)
            loneliness_delta = emotional_impact.get("loneliness", 0)
            strength_delta = (happiness_delta * 0.3) + (-loneliness_delta * 0.2)
            new_strength = max(0, min(100, int(current_strength + strength_delta)))

            self.db.table("relationships").update(
                {
                    "strength": new_strength,
                    "summary": event_description[:200],
                    "last_interaction": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", rel["id"]).execute()
        except Exception:  # noqa: BLE001
            logger.exception(
                "update_relationship_from_event failed for agent=%s npc=%s",
                agent_id,
                npc_name,
            )
