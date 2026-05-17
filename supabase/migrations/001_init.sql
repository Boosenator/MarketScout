create extension if not exists pgcrypto;

create table if not exists scout_sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  markets_scanned int default 0,
  ideas_generated int default 0,
  ideas_killed_p1 int default 0,
  ideas_killed_p2 int default 0,
  survivors int default 0,
  status text default 'running' check (status in ('running', 'done', 'failed')),
  created_at timestamptz default now()
);

create table if not exists scout_signals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references scout_sessions(id) on delete cascade,
  market_id text not null,
  title text not null,
  source text not null,
  relevance_note text,
  created_at timestamptz default now()
);

create table if not exists scout_ideas (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references scout_sessions(id) on delete cascade,
  market_id text not null,
  title text not null,
  description text,
  target_audience text,
  monetization text,
  why_now text,
  signals_used text[] default '{}',
  killed_at_pass int,
  kill_reason text,
  urgency_score int,
  timing_score int,
  advantage_score int,
  monetization_score int,
  competition_score int,
  mvp_speed_score int,
  total_score int,
  deep_dive jsonb,
  telegram_message_id bigint,
  created_at timestamptz default now()
);

create table if not exists idea_votes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references scout_ideas(id) on delete cascade,
  telegram_user_id bigint not null,
  telegram_username text,
  vote text not null check (vote in ('fire', 'maybe', 'skip')),
  voted_at timestamptz default now(),
  unique (idea_id, telegram_user_id)
);

create index if not exists scout_signals_session_idx on scout_signals(session_id);
create index if not exists scout_ideas_session_score_idx on scout_ideas(session_id, total_score desc);
create index if not exists idea_votes_idea_idx on idea_votes(idea_id);
