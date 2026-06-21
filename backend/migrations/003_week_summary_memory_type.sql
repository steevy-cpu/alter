-- Migration 003: add week_summary to agent_memories memory_type constraint
-- Run in Supabase SQL editor before deploying.
ALTER TABLE public.agent_memories
  DROP CONSTRAINT IF EXISTS agent_memories_memory_type_check;
ALTER TABLE public.agent_memories
  ADD CONSTRAINT agent_memories_memory_type_check
  CHECK (memory_type IN (
    'event','reflection','relationship','goal','lesson','week_summary'
  ));
