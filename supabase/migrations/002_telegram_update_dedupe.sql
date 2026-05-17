create table if not exists telegram_update_runs (
  id uuid primary key default gen_random_uuid(),
  telegram_update_id bigint not null unique,
  update_kind text not null,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  error_message text,
  created_at timestamptz default now(),
  finished_at timestamptz
);

create index if not exists telegram_update_runs_created_idx on telegram_update_runs(created_at desc);
