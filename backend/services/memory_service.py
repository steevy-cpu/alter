"""Memory service (Phase 2).

Stores agent memories as text and retrieves the most relevant ones using
PostgreSQL full-text search (via the `search_agent_memories` RPC), with a
recency-based fallback that works even before the RPC is created. Vector
embeddings are deferred (the `embedding` column is stored as NULL for now).

Every method swallows its errors and logs them — a memory failure must never
crash the simulation tick.
"""

import logging

from core.database import get_db

logger = logging.getLogger(__name__)

# Routine summarization model.
SUMMARY_MODEL = "claude-haiku-4-5-20251001"


class MemoryService:
    def __init__(self) -> None:
        self.db = get_db()

    async def store_memory(
        self,
        agent_id: str,
        content: str,
        memory_type: str,
        game_day: int,
        emotional_weight: float = 0.7,
    ) -> dict:
        """Insert a memory row. Returns the inserted row, or {} on failure."""
        try:
            res = (
                self.db.table("agent_memories")
                .insert(
                    {
                        "agent_id": agent_id,
                        "content": content,
                        "memory_type": memory_type,
                        "emotional_weight": emotional_weight,
                        "embedding": None,
                        "game_day": game_day,
                    }
                )
                .execute()
            )
            return res.data[0] if res.data else {}
        except Exception:  # noqa: BLE001 - never raise; the tick must survive
            logger.exception("store_memory failed for agent=%s type=%s", agent_id, memory_type)
            return {}

    async def retrieve_relevant(
        self, agent_id: str, query: str, limit: int = 5
    ) -> list[str]:
        """Return up to `limit` relevant memory contents for the agent.

        Tries the full-text-search RPC first; on any failure (including the
        RPC not existing yet) falls back to the most recent memories.
        """
        # Primary path: full-text search RPC.
        try:
            result = self.db.rpc(
                "search_agent_memories",
                {"p_agent_id": agent_id, "p_query": query, "p_limit": limit},
            ).execute()
            rows = result.data or []
            contents = [row["content"] for row in rows if row.get("content")]
            if contents:
                return contents
        except Exception:  # noqa: BLE001
            logger.warning(
                "search_agent_memories RPC failed for agent=%s; using recency fallback",
                agent_id,
            )

        # Fallback path: most recent memories by game day.
        try:
            res = (
                self.db.table("agent_memories")
                .select("content")
                .eq("agent_id", agent_id)
                .order("game_day", desc=True)
                .limit(limit)
                .execute()
            )
            return [row["content"] for row in (res.data or []) if row.get("content")]
        except Exception:  # noqa: BLE001
            logger.exception("retrieve_relevant fallback failed for agent=%s", agent_id)
            return []

    async def store_reflection_memory(
        self, agent_id: str, reflection: dict, game_day: int
    ) -> None:
        """Store the day's memory_to_keep as a reflection memory (if present)."""
        memory_to_keep = reflection.get("memory_to_keep")
        if not memory_to_keep:
            return
        await self.store_memory(
            agent_id=agent_id,
            content=memory_to_keep,
            memory_type="reflection",
            emotional_weight=0.7,
            game_day=game_day,
        )

    async def summarize_week(
        self,
        agent_id: str,
        agent_name: str,
        week_end_day: int,
        anthropic_client,
    ) -> None:
        """Compress the past 7 days of memories into one week_summary memory."""
        try:
            # Step 1 — fetch the week's memories (excluding prior summaries).
            res = (
                self.db.table("agent_memories")
                .select("content")
                .eq("agent_id", agent_id)
                .gt("game_day", week_end_day - 7)
                .lte("game_day", week_end_day)
                .neq("memory_type", "week_summary")
                .order("game_day", desc=False)
                .execute()
            )
            memories = [row["content"] for row in (res.data or []) if row.get("content")]

            # Step 2 — nothing meaningful to summarize.
            if len(memories) < 2:
                return

            joined_memories = "\n".join(f"- {m}" for m in memories)

            # Step 3 — summarize via the LLM.
            response = await anthropic_client.messages.create(
                model=SUMMARY_MODEL,
                max_tokens=500,
                system=(
                    "You summarize a person's week of memories into one "
                    "cohesive paragraph that captures the emotional arc, "
                    "key events, and what they learned. Write in third "
                    "person. Be specific and human."
                ),
                messages=[
                    {
                        "role": "user",
                        "content": (
                            f"Summarize {agent_name}'s week (days "
                            f"{week_end_day - 6} to {week_end_day}):\n\n{joined_memories}"
                        ),
                    }
                ],
            )
            text = next((b.text for b in response.content if b.type == "text"), "")
            if not text:
                return

            # Step 4 — store the summary as a high-weight memory.
            await self.store_memory(
                agent_id=agent_id,
                content=text,
                memory_type="week_summary",
                emotional_weight=0.9,
                game_day=week_end_day,
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "summarize_week failed for agent=%s day=%s", agent_id, week_end_day
            )
