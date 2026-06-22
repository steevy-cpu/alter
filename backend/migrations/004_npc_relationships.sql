-- Migration 004: NPC generation fields + relationship updates
-- Run in Supabase SQL editor before deploying.

-- Allow relationship_event in game_events
ALTER TABLE public.game_events
  DROP CONSTRAINT IF EXISTS game_events_event_type_check;
ALTER TABLE public.game_events
  ADD CONSTRAINT game_events_event_type_check
  CHECK (event_type IN (
    'daily_narrative','day_summary','cross_player',
    'goal_update','relationship_event','reflection','world_event'
  ));

-- Add npc_id column to relationships so we can look up NPC details
ALTER TABLE public.relationships
  ADD COLUMN IF NOT EXISTS npc_name text;
ALTER TABLE public.relationships
  ADD COLUMN IF NOT EXISTS npc_personality text;
ALTER TABLE public.relationships
  ADD COLUMN IF NOT EXISTS npc_occupation text;

-- Allow service role to insert into npcs
CREATE POLICY IF NOT EXISTS "Service can insert npcs"
  ON public.npcs FOR INSERT WITH CHECK (true);
