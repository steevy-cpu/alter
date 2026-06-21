-- Alter — Supabase database schema
-- Idempotent: safe to run multiple times.

-- Enable pgvector extension
create extension if not exists vector;

-- Users table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Agents table (one per user — their AI self)
create table if not exists public.agents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade unique not null,
  name text not null,
  age integer,
  city text,
  occupation text,
  personality_description text,
  strengths text[],
  weaknesses text[],
  goals text,
  fears text,
  habits text,
  career_direction text,
  relationship_goals text,
  desired_future text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Agent emotional state (updated every tick)
create table if not exists public.agent_state (
  id uuid default gen_random_uuid() primary key,
  agent_id uuid references public.agents(id) on delete cascade unique not null,
  energy integer default 75 check (energy between 0 and 100),
  happiness integer default 70 check (happiness between 0 and 100),
  stress integer default 30 check (stress between 0 and 100),
  motivation integer default 80 check (motivation between 0 and 100),
  loneliness integer default 40 check (loneliness between 0 and 100),
  current_focus text,
  last_updated timestamptz default now()
);

-- Agent memories (vector embeddings for semantic retrieval)
create table if not exists public.agent_memories (
  id uuid default gen_random_uuid() primary key,
  agent_id uuid references public.agents(id) on delete cascade not null,
  content text not null,
  memory_type text check (memory_type in ('event', 'reflection', 'relationship', 'goal', 'lesson')),
  emotional_weight float default 0.5,
  embedding vector(1536),
  game_day integer not null,
  created_at timestamptz default now()
);

-- Create vector similarity search index
create index if not exists agent_memories_embedding_idx on public.agent_memories
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Game events log (the narrative feed)
create table if not exists public.game_events (
  id uuid default gen_random_uuid() primary key,
  agent_id uuid references public.agents(id) on delete cascade not null,
  event_type text check (event_type in ('daily_narrative', 'cross_player', 'goal_update', 'relationship_event', 'reflection', 'world_event')),
  title text,
  content text not null,
  metadata jsonb default '{}',
  game_day integer not null,
  is_public boolean default false,
  created_at timestamptz default now()
);

-- Relationships (agent to agent, and agent to NPC)
create table if not exists public.relationships (
  id uuid default gen_random_uuid() primary key,
  agent_id uuid references public.agents(id) on delete cascade not null,
  target_id uuid not null,
  target_type text check (target_type in ('agent', 'npc')),
  relationship_type text check (relationship_type in ('friend', 'rival', 'romantic', 'colleague', 'family', 'acquaintance', 'stranger')),
  strength integer default 10 check (strength between 0 and 100),
  summary text,
  last_interaction timestamptz default now(),
  created_at timestamptz default now(),
  unique(agent_id, target_id)
);

-- NPCs (shared world characters)
create table if not exists public.npcs (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  personality text,
  occupation text,
  city text,
  is_global boolean default false,
  created_at timestamptz default now()
);

-- World state (shared across all players)
create table if not exists public.world_state (
  id uuid default gen_random_uuid() primary key,
  current_game_day integer default 1,
  active_agents integer default 0,
  last_tick timestamptz default now(),
  world_events jsonb default '[]'
);

-- Insert initial world state row (only if none exists)
insert into public.world_state (current_game_day, active_agents)
select 1, 0
where not exists (select 1 from public.world_state);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.agent_state enable row level security;
alter table public.agent_memories enable row level security;
alter table public.game_events enable row level security;
alter table public.relationships enable row level security;
alter table public.npcs enable row level security;
alter table public.world_state enable row level security;

-- RLS Policies: users can only access their own data
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

drop policy if exists "Users can view own agent" on public.agents;
create policy "Users can view own agent" on public.agents for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own agent" on public.agents;
create policy "Users can insert own agent" on public.agents for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own agent" on public.agents;
create policy "Users can update own agent" on public.agents for update using (auth.uid() = user_id);

drop policy if exists "Users can view own agent state" on public.agent_state;
create policy "Users can view own agent state" on public.agent_state for select using (
  agent_id in (select id from public.agents where user_id = auth.uid())
);

drop policy if exists "Users can view own memories" on public.agent_memories;
create policy "Users can view own memories" on public.agent_memories for select using (
  agent_id in (select id from public.agents where user_id = auth.uid())
);

drop policy if exists "Users can view own events" on public.game_events;
create policy "Users can view own events" on public.game_events for select using (
  agent_id in (select id from public.agents where user_id = auth.uid())
);

-- NPCs and world_state are public read
drop policy if exists "Anyone can read NPCs" on public.npcs;
create policy "Anyone can read NPCs" on public.npcs for select using (true);
drop policy if exists "Anyone can read world state" on public.world_state;
create policy "Anyone can read world state" on public.world_state for select using (true);
