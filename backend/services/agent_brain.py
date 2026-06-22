"""AgentBrain — the LLM reasoning core for an Alter (Phase 1).

Wraps an `anthropic.AsyncAnthropic` client and turns an agent's profile +
emotional state into a day plan, daily events, and an end-of-day reflection.
It also computes the next emotional state with pure Python (no LLM call).

Design rules:
- Every LLM call is wrapped in try/except. On any failure we log and return
  the safe defaults defined per method — an LLM error must never crash the
  simulation tick loop.
- All API calls are awaited against the async client.
- Routine ticks use claude-haiku-4-5 (fast, cheap). Major life events will use
  claude-sonnet-4-6 in a later phase.
"""

import json
import logging

logger = logging.getLogger(__name__)

# Routine tick model (fast + cheap). Major life events will use sonnet later.
ROUTINE_MODEL = "claude-haiku-4-5-20251001"
MAJOR_MODEL = "claude-sonnet-4-6"


def _clamp(value: int, low: int = 0, high: int = 100) -> int:
    return max(low, min(high, value))


def _extract_json(text: str):
    """Best-effort extraction of a JSON object/array from model output.

    Strips Markdown code fences and trims to the first/last bracket so minor
    formatting drift doesn't defeat json.loads. Raises on failure; callers
    handle the exception and fall back to safe defaults.
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # Drop the opening fence (``` or ```json) and the closing fence.
        cleaned = cleaned.split("```", 2)
        cleaned = cleaned[1] if len(cleaned) > 1 else text
        if cleaned.lstrip().lower().startswith("json"):
            cleaned = cleaned.lstrip()[4:]
    cleaned = cleaned.strip().strip("`").strip()
    return json.loads(cleaned)


def _build_system_prompt(agent_profile: dict, emotional_state: dict) -> str:
    """Construct the shared system prompt injecting identity + mood."""
    relationship_section = ""
    if agent_profile.get("relationship_context"):
        name_upper = (agent_profile.get("name") or "THEIR").upper()
        relationship_section = f"""

PEOPLE IN {name_upper}'S LIFE:
{agent_profile.get('relationship_context')}

When generating events and plans, naturally include these people
when contextually appropriate. Use their actual names."""

    return f"""
You are simulating the inner life of an AI person named {agent_profile.get('name')}. You are NOT
an assistant. You ARE this person. Think, feel, and plan as them.

ABOUT {agent_profile.get('name')}:
- Age: {agent_profile.get('age')}, living in {agent_profile.get('city')}, working as {agent_profile.get('occupation')}
- Personality: {agent_profile.get('personality_description')}
- Strengths: {', '.join(agent_profile.get('strengths') or [])}
- Weaknesses: {', '.join(agent_profile.get('weaknesses') or [])}
- Goals: {agent_profile.get('goals')}
- Fears: {agent_profile.get('fears')}
- Habits: {agent_profile.get('habits')}
- Career direction: {agent_profile.get('career_direction')}
- Relationship goals: {agent_profile.get('relationship_goals')}
- Desired future: {agent_profile.get('desired_future')}

CURRENT EMOTIONAL STATE (scale 0-100):
- Energy: {emotional_state.get('energy')}/100
- Happiness: {emotional_state.get('happiness')}/100
- Stress: {emotional_state.get('stress')}/100
- Motivation: {emotional_state.get('motivation')}/100
- Loneliness: {emotional_state.get('loneliness')}/100
- Current focus: {emotional_state.get('current_focus')}

You must make decisions that feel authentic to this specific person.
A low-energy day means slower choices. High stress affects judgment.
High motivation means ambitious plans. Loneliness shapes social behavior.
{relationship_section}
""".strip()


class AgentBrain:
    """LLM-backed reasoning for a single agent."""

    def __init__(self, client) -> None:
        # client: anthropic.AsyncAnthropic
        self.client = client

    # ----- Method 1: generate_day_plan ------------------------------------
    async def generate_day_plan(
        self,
        agent_profile: dict,
        memories: list[str],
        emotional_state: dict,
        game_day: int,
    ) -> dict:
        """Plan the agent's day. Returns a dict; safe defaults on failure."""
        name = agent_profile.get("name")
        memories_text = "\n".join(f"- {m}" for m in memories) if memories else "- (none yet)"

        system_prompt = _build_system_prompt(agent_profile, emotional_state)
        user_prompt = f"""
It is day {game_day} of {name}'s life in this world.

Recent memories:
{memories_text}

Based on who {name} is and how they feel right now, what is their plan for
today? What do they want to accomplish? What is on their mind?

Respond in JSON only. No explanation outside the JSON.
{{
  "morning_mood": "one sentence describing how they wake up feeling",
  "daily_intention": "one sentence — what they most want to do or achieve today",
  "planned_activities": ["activity 1", "activity 2", "activity 3"],
  "inner_thought": "a private thought they have — something personal, honest, maybe vulnerable",
  "focus_for_day": "work | social | self | rest | creative | adventure"
}}
""".strip()

        try:
            response = await self.client.messages.create(
                model=ROUTINE_MODEL,
                max_tokens=1024,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            text = next((b.text for b in response.content if b.type == "text"), "")
            return _extract_json(text)
        except Exception:  # noqa: BLE001 - never crash the tick loop
            logger.exception("generate_day_plan failed for agent=%s; using defaults", name)
            return {
                "morning_mood": "waking up slowly, not quite sure what today holds",
                "daily_intention": "take things one step at a time",
                "planned_activities": ["get through the day", "check in with goals", "rest"],
                "inner_thought": "just trying to figure things out",
                "focus_for_day": "self",
            }

    # ----- Method 2: generate_daily_events --------------------------------
    async def generate_daily_events(
        self,
        agent_profile: dict,
        day_plan: dict,
        emotional_state: dict,
        game_day: int,
    ) -> list[dict]:
        """Generate exactly 3 events for the day. Safe default on failure."""
        name = agent_profile.get("name")
        activities = day_plan.get("planned_activities") or []

        system_prompt = _build_system_prompt(agent_profile, emotional_state)
        user_prompt = f"""
{name} planned to: {day_plan.get('daily_intention')}
Their activities: {', '.join(activities)}
Their focus today: {day_plan.get('focus_for_day')}

Known people in their life:
{agent_profile.get('relationship_context', 'None yet')}

When events involve social interactions, prefer using the named people above
rather than generic "a friend" or "someone".

Generate exactly 3 events that happen to {name} today. Events should feel
real and personal — connected to their goals, fears, habits, and current
emotional state. Mix small moments with meaningful ones. Not every event
is positive. Failure, awkwardness, small victories, unexpected encounters —
all are valid.

Respond in JSON only. Return a JSON array of exactly 3 events.
[
  {{
    "time_of_day": "morning | afternoon | evening",
    "title": "short title (max 8 words)",
    "description": "what happened — 2 to 4 sentences, written in third person",
    "emotional_impact": {{
      "energy": -10 to +10,
      "happiness": -15 to +15,
      "stress": -10 to +10,
      "motivation": -10 to +10,
      "loneliness": -15 to +15
    }},
    "event_type": "work | social | personal | unexpected | goal_progress | setback",
    "is_significant": true or false
  }}
]
""".strip()

        try:
            response = await self.client.messages.create(
                model=ROUTINE_MODEL,
                max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            text = next((b.text for b in response.content if b.type == "text"), "")
            events = _extract_json(text)
            if not isinstance(events, list) or not events:
                raise ValueError("expected a non-empty JSON array of events")
            return events
        except Exception:  # noqa: BLE001
            logger.exception("generate_daily_events failed for agent=%s; using default", name)
            return [
                {
                    "time_of_day": "afternoon",
                    "title": "A quiet day passes",
                    "description": (
                        f"{agent_profile.get('name')} moves through the day steadily. "
                        "Nothing dramatic happens, but there is a quiet sense of forward motion."
                    ),
                    "emotional_impact": {
                        "energy": -5,
                        "happiness": 0,
                        "stress": -5,
                        "motivation": 0,
                        "loneliness": 0,
                    },
                    "event_type": "personal",
                    "is_significant": False,
                }
            ]

    # ----- Method 3: generate_reflection ----------------------------------
    async def generate_reflection(
        self,
        agent_profile: dict,
        day_plan: dict,
        events: list[dict],
        emotional_state: dict,
        game_day: int,
    ) -> dict:
        """End-of-day reflection. Safe defaults on failure."""
        name = agent_profile.get("name")
        events_summary = "\n".join(
            f"- [{e.get('time_of_day')}] {e.get('title')}: {e.get('description')}"
            for e in events
        ) or "- (a quiet, uneventful day)"

        system_prompt = _build_system_prompt(agent_profile, emotional_state)
        user_prompt = f"""
It is the end of day {game_day} for {name}.

Their plan was: {day_plan.get('daily_intention')}

What happened today:
{events_summary}

Now {name} reflects on the day.

Respond in JSON only.
{{
  "reflection": "2-3 sentences of genuine personal reflection — honest, emotional, specific to what happened",
  "lesson": "one thing they learned or noticed today, even if small",
  "emotional_shift": "how their feelings changed from morning to night",
  "memory_to_keep": "one specific moment from today worth remembering — a sentence",
  "tomorrow_intention": "what they want to do or feel differently tomorrow"
}}
""".strip()

        try:
            response = await self.client.messages.create(
                model=ROUTINE_MODEL,
                max_tokens=1024,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            text = next((b.text for b in response.content if b.type == "text"), "")
            return _extract_json(text)
        except Exception:  # noqa: BLE001
            logger.exception("generate_reflection failed for agent=%s; using defaults", name)
            return {
                "reflection": "Today was just another day, but it still counted for something.",
                "lesson": "small steps still move me forward",
                "emotional_shift": "steady, neither up nor down",
                "memory_to_keep": "A quiet, ordinary moment that felt oddly grounding.",
                "tomorrow_intention": "try to be a little more present",
            }

    # ----- Method 4: compute_emotional_delta (pure Python, no LLM) ---------
    def compute_emotional_delta(self, current_state: dict, events: list[dict]) -> dict:
        """Compute the next emotional state from event impacts + daily decay.

        new_value = clamp(current + sum_of_impacts + decay, 0, 100)
        Decay: energy -5 (rest doesn't fully recover), loneliness +3 (isolation
        creeps up daily). current_focus is preserved unchanged.
        """
        dimensions = ["energy", "happiness", "stress", "motivation", "loneliness"]
        decay = {"energy": -5, "loneliness": 3}

        new_state = dict(current_state)  # preserve current_focus and any extras
        for dim in dimensions:
            current = int(current_state.get(dim, 0))
            impact_sum = 0
            for event in events:
                impact = event.get("emotional_impact") or {}
                impact_sum += int(impact.get(dim, 0))
            new_state[dim] = _clamp(current + impact_sum + decay.get(dim, 0))

        new_state["current_focus"] = current_state.get("current_focus")
        return new_state
