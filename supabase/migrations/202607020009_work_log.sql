-- Praca: work log with time ranges and categories for habit self-analysis

create table if not exists work_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  note text not null default '',
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_log_entries_user_id_idx on work_log_entries(user_id);
create index if not exists work_log_entries_started_at_idx on work_log_entries(started_at);

-- only one open (in-progress) entry per user at a time
create unique index if not exists work_log_entries_one_open_idx
  on work_log_entries (user_id)
  where ended_at is null;

alter table work_log_entries enable row level security;

drop policy if exists "Users manage own work log entries" on work_log_entries;
create policy "Users manage own work log entries" on work_log_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
