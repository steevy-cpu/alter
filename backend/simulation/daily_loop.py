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
from services.memory_service import MemoryService
from services.npc_service import NpcService
from services.world_event_engine import WorldEventEngine

logger = logging.getLogger(__name__)

# Module-level singletons — one client + brain + memory/npc service shared
# across all ticks.
_anthropic_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
_brain = AgentBrain(_anthropic_client)
_memory_service = MemoryService()
_npc_service = NpcService(_anthropic_client)
_world_engine = WorldEventEngine(_anthropic_client)


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

    # Step 2b — fetch current relationships and build a compact context string
    # to inject into the LLM prompts (capped at 5, under ~300 chars).
    relationships = await _npc_service.get_agent_relationships(agent["id"])
    if relationships:
        rel_lines = []
        for r in relationships[:5]:
            name = r.get("npc_name", "Someone")
            rel_type = r.get("relationship_type", "acquaintance")
            strength = r.get("strength", 30)
            summary = r.get("summary", "")
            rel_lines.append(f"- {name} ({rel_type}, bond {strength}/100): {summary}")
        relationship_context = "\n".join(rel_lines)
    else:
        relationship_context = "No established relationships yet."
    agent_profile["relationship_context"] = relationship_context

    # Step 3 — retrieve relevant memories via the memory service (full-text
    # search keyed on the agent's goals + occupation, recency fallback).
    memories_raw = await _memory_service.retrieve_relevant(
        agent_id=agent["id"],
        query=f"{agent_profile['goals']} {agent_profile['occupation']}",
        limit=5,
    )
    memories = memories_raw if memories_raw else [
        "This is the first day of your life in this world."
    ]

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

    # 8b2) Update relationships when a known NPC appears in today's events.
    for event in events:
        desc = event.get("description", "")
        impact = event.get("emotional_impact", {})
        for rel in relationships:
            npc_name = rel.get("npc_name", "")
            if npc_name and npc_name.split()[0] in desc:
                await _npc_service.update_relationship_from_event(
                    agent_id=agent["id"],
                    npc_name=npc_name,
                    event_description=desc,
                    emotional_impact=impact,
                )
                break  # one update per event

    # 8c) Store the memory_to_keep as a reflection memory via the service.
    await _memory_service.store_reflection_memory(
        agent_id=agent["id"],
        reflection=reflection,
        game_day=game_day,
    )

    # Every 7 game days, compress memories into a week summary.
    agent_start_day = agent.get("starting_game_day", 1)
    days_lived = game_day - agent_start_day
    if days_lived > 0 and days_lived % 7 == 0:
        await _memory_service.summarize_week(
            agent_id=agent["id"],
            agent_name=agent_profile["name"],
            week_end_day=game_day,
            anthropic_client=_anthropic_client,
        )
        logger.info("Week summary generated for %s at day %s", name, game_day)

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
            "relationships": [
                {
                    "name": r.get("npc_name", ""),
                    "relationship_type": r.get("relationship_type", ""),
                    "strength": r.get("strength", 0),
                    "summary": (r.get("summary") or "")[:80],
                }
                for r in relationships[:5]
            ],
        },
    }
    ws_payload["payload"]["days_lived"] = game_day - agent.get("starting_game_day", 1)
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

    # Step 4 — cross-player encounters (runs after all agents complete their day).
    try:
        encounters = await _world_engine.check_and_generate_encounters(
            agents=agents,
            states=states_by_agent,
            game_day=game_day,
        )

        for encounter in encounters:
            # 4a) Persist two game_event rows — one perspective per agent.
            try:
                rows = [
                    {
                        "agent_id": encounter["agent_id_a"],
                        "event_type": "cross_player",
                        "title": encounter["title"],
                        "content": encounter["narrative_a"],
                        "metadata": {
                            "other_agent_name": encounter["name_b"],
                            "location": encounter["location"],
                            "connection_potential": encounter["connection_potential"],
                            "emotional_impact": encounter["emotional_impact_a"],
                        },
                        "game_day": game_day,
                        "is_public": True,
                    },
                    {
                        "agent_id": encounter["agent_id_b"],
                        "event_type": "cross_player",
                        "title": encounter["title"],
                        "content": encounter["narrative_b"],
                        "metadata": {
                            "other_agent_name": encounter["name_a"],
                            "location": encounter["location"],
                            "connection_potential": encounter["connection_potential"],
                            "emotional_impact": encounter["emotional_impact_b"],
                        },
                        "game_day": game_day,
                        "is_public": True,
                    },
                ]
                db.table("game_events").insert(rows).execute()
            except Exception:  # noqa: BLE001
                logger.exception("Failed to persist encounter events")
                continue

            # 4b) Apply emotional impact to both agents' state rows.
            try:
                def apply_impact(state: dict, impact: dict) -> dict:
                    new = dict(state)
                    for key, val in impact.items():
                        if key in new:
                            new[key] = max(0, min(100, int(new.get(key, 50)) + int(val)))
                    return new

                state_a = states_by_agent.get(encounter["agent_id_a"], {})
                state_b = states_by_agent.get(encounter["agent_id_b"], {})
                new_state_a = apply_impact(state_a, encounter["emotional_impact_a"])
                new_state_b = apply_impact(state_b, encounter["emotional_impact_b"])

                now = datetime.now(timezone.utc).isoformat()
                db.table("agent_state").update(
                    {
                        "energy": new_state_a.get("energy"),
                        "happiness": new_state_a.get("happiness"),
                        "loneliness": new_state_a.get("loneliness"),
                        "last_updated": now,
                    }
                ).eq("agent_id", encounter["agent_id_a"]).execute()
                db.table("agent_state").update(
                    {
                        "energy": new_state_b.get("energy"),
                        "happiness": new_state_b.get("happiness"),
                        "loneliness": new_state_b.get("loneliness"),
                        "last_updated": now,
                    }
                ).eq("agent_id", encounter["agent_id_b"]).execute()
            except Exception:  # noqa: BLE001
                logger.exception("Failed to update emotional state after encounter")

            # 4c) Broadcast each player's own perspective only.
            try:
                await manager.send_to_user(
                    encounter["user_id_a"],
                    {
                        "type": "cross_player_encounter",
                        "payload": {
                            "game_day": game_day,
                            "title": encounter["title"],
                            "location": encounter["location"],
                            "narrative": encounter["narrative_a"],
                            "other_person": encounter["name_b"],
                            "connection_potential": encounter["connection_potential"],
                            "emotional_impact": encounter["emotional_impact_a"],
                        },
                    },
                )
                await manager.send_to_user(
                    encounter["user_id_b"],
                    {
                        "type": "cross_player_encounter",
                        "payload": {
                            "game_day": game_day,
                            "title": encounter["title"],
                            "location": encounter["location"],
                            "narrative": encounter["narrative_b"],
                            "other_person": encounter["name_a"],
                            "connection_potential": encounter["connection_potential"],
                            "emotional_impact": encounter["emotional_impact_b"],
                        },
                    },
                )
                logger.info(
                    "Cross-player encounter broadcast: %s + %s at %s",
                    encounter["name_a"],
                    encounter["name_b"],
                    encounter["location"],
                )
            except Exception:  # noqa: BLE001
                logger.exception("Failed to broadcast encounter")

    except Exception:  # noqa: BLE001
        logger.exception("Cross-player encounter step failed")
