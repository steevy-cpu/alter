"""The daily simulation loop (Phase 1).

`run_tick()` is the heartbeat of Alter's world, invoked by the APScheduler
tick scheduler every TICK_INTERVAL_SECONDS. Each tick advances the game day,
then processes every active agent concurrently: plan the day, generate events,
reflect, update emotional state, persist everything, and broadcast a small
delta to the agent's connected WebSocket client.

Resilience rules:
- All LLM and DB calls are wrapped in try/except. One agent's failure must not
  stop the others (we use asyncio.gather with per-agent error isolation).
- WebSocket payloads stay small — only the day's narrative, never full memory
  arrays or large metadata blobs.
"""

import asyncio
import logging
from datetime import datetime, timezone

import anthropic

from core.config import settings
from core.database import get_db
from core.websocket_manager import manager
from services.agent_brain import AgentBrain

logger = logging.getLogger(__name__)

# Module-level singletons — one client + brain shared across all ticks.
_anthropic_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
_brain = AgentBrain(_anthropic_client)


def build_narrative_content(day_plan: dict, events: list[dict], reflection: dict) -> str:
    """Build a readable narrative string for the daily game_event row.

    Handles event lists with fewer than 3 items gracefully.
    """
    labels = ["Morning", "Afternoon", "Evening"]
    lines = []
    for i, event in enumerate(events):
        label = labels[i] if i < len(labels) else (event.get("time_of_day") or "Later").title()
        lines.append(f"[{label}] {event.get('title')}: {event.get('description')}")
    happened = "\n".join(lines) if lines else "[—] A quiet day passes."

    return f"""MORNING — {day_plan.get('morning_mood')}

Today's intention: {day_plan.get('daily_intention')}
Inner thought: {day_plan.get('inner_thought')}

WHAT HAPPENED:
{happened}

REFLECTION:
{reflection.get('reflection')}

Lesson: {reflection.get('lesson')}
Tomorrow: {reflection.get('tomorrow_intention')}""".strip()


async def process_single_agent(agent: dict, state: dict, game_day: int) -> None:
    """Run the full daily pipeline for one agent."""
    db = get_db()
    name = agent.get("name")

    # Step 1 — agent_profile from the agent row.
    agent_profile = {
        "name": agent.get("name"),
        "age": agent.get("age"),
        "city": agent.get("city"),
        "occupation": agent.get("occupation"),
        "personality_description": agent.get("personality_description"),
        "strengths": agent.get("strengths") or [],
        "weaknesses": agent.get("weaknesses") or [],
        "goals": agent.get("goals"),
        "fears": agent.get("fears"),
        "habits": agent.get("habits"),
        "career_direction": agent.get("career_direction"),
        "relationship_goals": agent.get("relationship_goals"),
        "desired_future": agent.get("desired_future"),
    }

    # Step 2 — emotional_state from the state row.
    emotional_state = {
        "energy": state.get("energy", 75),
        "happiness": state.get("happiness", 70),
        "stress": state.get("stress", 30),
        "motivation": state.get("motivation", 80),
        "loneliness": state.get("loneliness", 40),
        "current_focus": state.get("current_focus"),
    }

    # Step 3 — fetch recent memories (last 5).
    memories: list[str] = []
    try:
        mem_res = (
            db.table("agent_memories")
            .select("content")
            .eq("agent_id", agent["id"])
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        memories = [row["content"] for row in (mem_res.data or []) if row.get("content")]
    except Exception:  # noqa: BLE001
        logger.exception("[%s day %s] failed to fetch memories", name, game_day)
    if not memories:
        memories = ["This is the first day of your life in this world."]

    # Step 4 — day plan.
    day_plan = await _brain.generate_day_plan(agent_profile, memories, emotional_state, game_day)
    logger.info("Day plan for %s: %s", name, day_plan.get("daily_intention"))

    # Step 5 — daily events.
    events = await _brain.generate_daily_events(agent_profile, day_plan, emotional_state, game_day)

    # Step 6 — reflection.
    reflection = await _brain.generate_reflection(
        agent_profile, day_plan, events, emotional_state, game_day
    )

    # Step 7 — new emotional state.
    new_emotional_state = _brain.compute_emotional_delta(emotional_state, events)
    new_emotional_state["current_focus"] = day_plan.get("focus_for_day")

    # Step 8 — persist everything.
    now = datetime.now(timezone.utc).isoformat()

    # 8a) Update agent_state.
    try:
        db.table("agent_state").update(
            {
                "energy": new_emotional_state["energy"],
                "happiness": new_emotional_state["happiness"],
                "stress": new_emotional_state["stress"],
                "motivation": new_emotional_state["motivation"],
                "loneliness": new_emotional_state["loneliness"],
                "current_focus": new_emotional_state["current_focus"],
                "last_updated": now,
            }
        ).eq("agent_id", agent["id"]).execute()
    except Exception:  # noqa: BLE001
        logger.exception("[%s day %s] failed to update agent_state", name, game_day)

    # 8b) Insert the daily narrative event + one row per event.
    try:
        rows = [
            {
                "agent_id": agent["id"],
                "event_type": "day_summary",
                "title": day_plan.get("daily_intention"),
                "content": build_narrative_content(day_plan, events, reflection),
                "metadata": {
                    "day_plan": day_plan,
                    "events": events,
                    "reflection": reflection,
                },
                "game_day": game_day,
                "is_public": False,
            }
        ]
        for event in events:
            rows.append(
                {
                    "agent_id": agent["id"],
                    "event_type": "daily_narrative",
                    "title": event.get("title"),
                    "content": event.get("description"),
                    "metadata": {
                        "time_of_day": event.get("time_of_day"),
                        "event_type": event.get("event_type"),
                    },
                    "game_day": game_day,
                    "is_public": False,
                }
            )
        db.table("game_events").insert(rows).execute()
    except Exception:  # noqa: BLE001
        logger.exception("[%s day %s] failed to insert game_events", name, game_day)

    # 8c) Store the memory_to_keep as a reflection memory.
    memory_to_keep = reflection.get("memory_to_keep")
    if memory_to_keep:
        try:
            db.table("agent_memories").insert(
                {
                    "agent_id": agent["id"],
                    "content": memory_to_keep,
                    "memory_type": "reflection",
                    "emotional_weight": 0.7,
                    "embedding": None,  # vector embeddings arrive in Phase 2
                    "game_day": game_day,
                }
            ).execute()
        except Exception:  # noqa: BLE001
            logger.exception("[%s day %s] failed to insert memory", name, game_day)

    # Step 9 — broadcast a small delta to the agent's user.
    user_id = agent.get("user_id")
    ws_payload = {
        "type": "daily_update",
        "payload": {
            "game_day": game_day,
            "morning_mood": day_plan.get("morning_mood"),
            "daily_intention": day_plan.get("daily_intention"),
            "inner_thought": day_plan.get("inner_thought"),
            "events": [
                {
                    "time_of_day": e.get("time_of_day"),
                    "title": e.get("title"),
                    "description": e.get("description"),
                    "event_type": e.get("event_type"),
                }
                for e in events
            ],
            "reflection": reflection.get("reflection"),
            "lesson": reflection.get("lesson"),
            "memory_to_keep": reflection.get("memory_to_keep"),
            "tomorrow_intention": reflection.get("tomorrow_intention"),
            "emotional_state": new_emotional_state,
        },
    }
    try:
        await manager.send_to_user(user_id, ws_payload)
        logger.info("Broadcast sent to user=%s for agent=%s", user_id, name)
    except Exception:  # noqa: BLE001
        logger.exception("[%s day %s] failed to broadcast", name, game_day)


async def run_tick() -> None:
    """Advance the simulation by one tick: bump the day, run all agents."""
    db = get_db()

    # Step 1 — get world state, increment the game day.
    try:
        world_res = db.table("world_state").select("*").limit(1).execute()
        if not world_res.data:
            logger.warning("No world_state row found; skipping tick")
            return
        world = world_res.data[0]
        game_day = int(world.get("current_game_day", 1)) + 1
        db.table("world_state").update(
            {
                "current_game_day": game_day,
                "last_tick": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", world["id"]).execute()
    except Exception:  # noqa: BLE001
        logger.exception("Failed to advance world_state; aborting tick")
        return

    logger.info("=== Tick: Game Day %s ===", game_day)

    # Step 2 — get all active agents + their state rows.
    try:
        agents_res = db.table("agents").select("*").eq("is_active", True).execute()
        agents = agents_res.data or []
    except Exception:  # noqa: BLE001
        logger.exception("Failed to load active agents; aborting tick")
        return

    if not agents:
        logger.info("No active agents")
        return

    # Build a map of agent_id -> state for the join.
    try:
        agent_ids = [a["id"] for a in agents]
        state_res = (
            db.table("agent_state").select("*").in_("agent_id", agent_ids).execute()
        )
        states_by_agent = {s["agent_id"]: s for s in (state_res.data or [])}
    except Exception:  # noqa: BLE001
        logger.exception("Failed to load agent_state rows; aborting tick")
        return

    # Step 3 — process all agents concurrently, isolating per-agent failures.
    async def _safe_process(agent: dict) -> None:
        state = states_by_agent.get(agent["id"]) or {}
        try:
            await process_single_agent(agent, state, game_day)
        except Exception:  # noqa: BLE001 - never let one agent stop the others
            logger.exception(
                "process_single_agent crashed for agent=%s day=%s",
                agent.get("name"),
                game_day,
            )

    await asyncio.gather(*[_safe_process(agent) for agent in agents])
