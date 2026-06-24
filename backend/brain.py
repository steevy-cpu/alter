"""
brain.py — The reasoning core that lets Claude drive Steeve's body.

The AI never touches bones or pixels. It picks ONE high-level action from the
vocabulary in world.py. The simulation turns that into movement; the frontend
turns the resulting state into animation. This keeps the "AI controls the body"
loop clean: perception (state) -> decision (action) -> world update -> render.

Requires: ANTHROPIC_API_KEY in the environment (already in your backend .env).
"""

from __future__ import annotations
import json
import os
from typing import Optional

from anthropic import AsyncAnthropic

from world import AlterState, Action, LOCATIONS, ACTION_SCHEMA

_client: Optional[AsyncAnthropic] = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


def _system_prompt(persona: str) -> str:
    place_list = "\n".join(f"  - {name}" for name in LOCATIONS)
    return (
        f"You are the inner decision-making of {persona}, an autonomous person "
        f"living in a small city. You are NOT a chat assistant — you decide what "
        f"this person does next, moment to moment, as if living a life.\n\n"
        f"Places you can walk to:\n{place_list}\n\n"
        "Choose exactly one next action. Prefer variety and a believable daily "
        "rhythm: spend time in the park, visit the cafe, go to the office, walk "
        "by the beach, return home to rest. Don't repeat the same action forever. "
        "Respond ONLY with a JSON object matching the provided schema — no prose, "
        "no markdown, no backticks."
    )


def _user_prompt(state: AlterState, recent: list[str]) -> str:
    cur = state.target or "(here)"
    history = ", ".join(recent[-6:]) if recent else "nothing yet"
    return (
        f"Current position: x={state.x:.1f}, z={state.z:.1f}. "
        f"Current action: {state.action}. Heading to: {cur}. "
        f"Recent actions: {history}.\n"
        "What do you do next?"
    )


async def decide_next_action(
    state: AlterState,
    persona: str,
    recent_actions: list[str],
    model: str = "claude-sonnet-4-6",
) -> dict:
    """Ask Claude for Steeve's next high-level action.

    Returns a dict: {"action": str, "target": str|None, "reason": str}.
    Falls back to idle on any parsing/API hiccup so the sim never stalls.
    """
    client = _get_client()
    schema_hint = json.dumps(ACTION_SCHEMA)

    try:
        msg = await client.messages.create(
            model=model,
            max_tokens=200,
            system=_system_prompt(persona),
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"{_user_prompt(state, recent_actions)}\n\n"
                        f"JSON schema you must follow:\n{schema_hint}"
                    ),
                }
            ],
        )
        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(text)
        action = data.get("action", Action.IDLE.value)
        target = data.get("target")
        if target not in LOCATIONS:
            target = None
        return {"action": action, "target": target, "reason": data.get("reason", "")}
    except Exception as exc:  # noqa: BLE001 — degrade gracefully
        return {"action": Action.IDLE.value, "target": None, "reason": f"(fallback: {exc})"}
