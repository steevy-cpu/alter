-- Migration 001: add starting_game_day to agents
-- Run manually in the Supabase SQL editor.
--
-- Records the world's game day at the moment an agent is created, so we can
-- compute how many days an Alter has lived ("day N of their life").

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS starting_game_day integer DEFAULT 1;
