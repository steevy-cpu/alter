-- Run in Supabase SQL editor before deploying.
--
-- Migration 002: full-text search over agent_memories.
-- Powers MemoryService.retrieve_relevant(). If this function is absent the
-- service falls back to recency-based retrieval, so deploying before running
-- this is safe (just less relevant).

CREATE OR REPLACE FUNCTION search_agent_memories(
  p_agent_id uuid,
  p_query text,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(content text, emotional_weight float, game_day integer)
LANGUAGE sql STABLE AS $$
  SELECT content, emotional_weight, game_day
  FROM agent_memories
  WHERE agent_id = p_agent_id
    AND (
      p_query = '' OR
      to_tsvector('english', content) @@ plainto_tsquery('english', p_query)
    )
  ORDER BY emotional_weight DESC, game_day DESC
  LIMIT p_limit;
$$;
