-- Migration 005: cross-player encounter tracking
-- Run in Supabase SQL editor before deploying.

-- Track which agent pairs have already met to avoid
-- triggering encounters every single tick
CREATE TABLE IF NOT EXISTS public.agent_encounters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id_a uuid REFERENCES public.agents(id) ON DELETE CASCADE,
  agent_id_b uuid REFERENCES public.agents(id) ON DELETE CASCADE,
  encounter_count integer DEFAULT 1,
  last_encounter_day integer,
  relationship_formed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(agent_id_a, agent_id_b)
);

-- RLS
ALTER TABLE public.agent_encounters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can view own encounters"
  ON public.agent_encounters FOR SELECT
  USING (
    agent_id_a IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
    OR
    agent_id_b IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );
