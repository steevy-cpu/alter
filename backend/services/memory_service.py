"""Memory service.

Handles storing agent memories with vector embeddings and retrieving the
most relevant memories for a given context via pgvector similarity search.
Stub implementation for now.
"""

import logging

logger = logging.getLogger(__name__)


class MemoryService:
    """Create and semantically retrieve agent memories."""

    async def store_memory(
        self, agent_id: str, content: str, memory_type: str, game_day: int
    ) -> dict:
        """Embed and persist a memory (stub).

        Will compute an embedding and insert into `agent_memories`.
        """
        logger.info("store_memory: agent=%s type=%s", agent_id, memory_type)
        return {"status": "stub", "stored": False}

    async def retrieve_relevant(
        self, agent_id: str, query: str, limit: int = 5
    ) -> list[dict]:
        """Retrieve the most relevant memories for `query` (stub).

        Will embed the query and run an ivfflat cosine similarity search.
        """
        logger.info("retrieve_relevant: agent=%s limit=%d", agent_id, limit)
        return []
