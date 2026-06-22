"""World event engine — generates cross-player encounters between agents."""

import json
import logging
import random
from datetime import datetime, timezone

from core.database import get_db

logger = logging.getLogger(__name__)

MODEL = "claude-haiku-4-5-20251001"

ENCOUNTER_CHANCE = 0.4
MIN_DAYS_BETWEEN_ENCOUNTERS = 3


class WorldEventEngine:
    def __init__(self, anthropic_client) -> None:
        self.client = anthropic_client
        self.db = get_db()

    async def check_and_generate_encounters(
        self,
        agents: list[dict],
        states: dict,
        game_day: int,
    ) -> list[dict]:
        """Check all agent pairs and potentially generate encounters.

        Returns list of encounter dicts to be broadcast. Called once per tick
        after all agents have processed their daily loop. Never raises.
        """
        try:
            if len(agents) < 2:
                return []

            encounters = []
            for i in range(len(agents)):
                for j in range(i + 1, len(agents)):
                    agent_a = agents[i]
                    agent_b = agents[j]

                    if agent_a.get("city") != agent_b.get("city"):
                        continue

                    last = await self._get_last_encounter(agent_a["id"], agent_b["id"])
                    if last is not None and (game_day - last) < MIN_DAYS_BETWEEN_ENCOUNTERS:
                        continue

                    if random.random() > ENCOUNTER_CHANCE:
                        continue

                    state_a = states.get(agent_a["id"], {})
                    state_b = states.get(agent_b["id"], {})

                    encounter = await self._generate_encounter(
                        agent_a, agent_b, state_a, state_b, game_day
                    )
                    if encounter:
                        encounters.append(encounter)
                        await self._record_encounter(agent_a["id"], agent_b["id"], game_day)

            return encounters
        except Exception:  # noqa: BLE001
            logger.exception("check_and_generate_encounters failed")
            return []

    async def _get_last_encounter(self, agent_id_a: str, agent_id_b: str) -> int | None:
        """Return game_day of last encounter between two agents, or None."""
        try:
            res = (
                self.db.table("agent_encounters")
                .select("last_encounter_day")
                .or_(
                    f"and(agent_id_a.eq.{agent_id_a},agent_id_b.eq.{agent_id_b}),"
                    f"and(agent_id_a.eq.{agent_id_b},agent_id_b.eq.{agent_id_a})"
                )
                .limit(1)
                .execute()
            )
            if res.data:
                return res.data[0].get("last_encounter_day")
            return None
        except Exception:  # noqa: BLE001
            return None

    async def _generate_encounter(
        self,
        agent_a: dict,
        agent_b: dict,
        state_a: dict,
        state_b: dict,
        game_day: int,
    ) -> dict | None:
        """Generate a cross-player encounter narrative via the LLM."""
        name_a = agent_a.get("name")
        name_b = agent_b.get("name")
        city = agent_a.get("city")

        system = (
            "You write brief, realistic encounter narratives for a life simulation. "
            "Two people from different lives cross paths in the same city. "
            "The encounter should feel natural — not forced or dramatic. "
            "It can be small: a conversation at a coffee shop, sitting near each other "
            "at a library, meeting at an event. It should hint at potential connection "
            "or interesting contrast without resolving anything. "
            "Return ONLY valid JSON."
        )
        user = f"""Two people cross paths in {city} on day {game_day}.

Person A — {name_a}:
- {agent_a.get('occupation')}
- Personality: {(agent_a.get('personality_description') or '')[:150]}
- Current emotional state: energy {state_a.get('energy', 50)}/100, loneliness {state_a.get('loneliness', 50)}/100
- Goals: {(agent_a.get('goals') or '')[:100]}

Person B — {name_b}:
- {agent_b.get('occupation')}
- Personality: {(agent_b.get('personality_description') or '')[:150]}
- Current emotional state: energy {state_b.get('energy', 50)}/100, loneliness {state_b.get('loneliness', 50)}/100
- Goals: {(agent_b.get('goals') or '')[:100]}

Generate a brief encounter between them. Return JSON:
{{
  "location": "specific place in {city} (e.g. a coffee shop, library, park)",
  "title": "short title max 8 words",
  "narrative_a": "2-3 sentences from {name_a}'s perspective — what they noticed, felt, thought",
  "narrative_b": "2-3 sentences from {name_b}'s perspective — what they noticed, felt, thought",
  "emotional_impact_a": {{
    "loneliness": -5 to -15,
    "happiness": 0 to 10,
    "energy": -5 to 5
  }},
  "emotional_impact_b": {{
    "loneliness": -5 to -15,
    "happiness": 0 to 10,
    "energy": -5 to 5
  }},
  "connection_potential": "low | medium | high"
}}"""

        try:
            response = await self.client.messages.create(
                model=MODEL,
                max_tokens=800,
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
            data = json.loads(cleaned.strip())

            return {
                "agent_id_a": agent_a["id"],
                "agent_id_b": agent_b["id"],
                "user_id_a": agent_a["user_id"],
                "user_id_b": agent_b["user_id"],
                "name_a": name_a,
                "name_b": name_b,
                "location": data.get("location"),
                "title": data.get("title"),
                "narrative_a": data.get("narrative_a"),
                "narrative_b": data.get("narrative_b"),
                "emotional_impact_a": data.get("emotional_impact_a", {}),
                "emotional_impact_b": data.get("emotional_impact_b", {}),
                "connection_potential": data.get("connection_potential", "low"),
                "game_day": game_day,
            }
        except Exception:  # noqa: BLE001
            logger.exception("encounter generation failed for %s + %s", name_a, name_b)
            return None

    async def _record_encounter(
        self, agent_id_a: str, agent_id_b: str, game_day: int
    ) -> None:
        """Upsert the encounter record. Never raises."""
        try:
            res = (
                self.db.table("agent_encounters")
                .select("id, encounter_count")
                .or_(
                    f"and(agent_id_a.eq.{agent_id_a},agent_id_b.eq.{agent_id_b}),"
                    f"and(agent_id_a.eq.{agent_id_b},agent_id_b.eq.{agent_id_a})"
                )
                .limit(1)
                .execute()
            )
            if res.data:
                row = res.data[0]
                self.db.table("agent_encounters").update(
                    {
                        "encounter_count": (row.get("encounter_count") or 0) + 1,
                        "last_encounter_day": game_day,
                    }
                ).eq("id", row["id"]).execute()
            else:
                self.db.table("agent_encounters").insert(
                    {
                        "agent_id_a": agent_id_a,
                        "agent_id_b": agent_id_b,
                        "last_encounter_day": game_day,
                        "encounter_count": 1,
                    }
                ).execute()
        except Exception:  # noqa: BLE001
            logger.exception("_record_encounter failed")
