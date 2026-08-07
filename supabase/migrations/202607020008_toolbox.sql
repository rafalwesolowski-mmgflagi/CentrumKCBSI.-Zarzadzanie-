-- Narzedziownik: quick operational thinking tools (5W2H, Ishikawa, RACI, Eisenhower, OODA)

do $$ begin
  create type toolbox_tool_type as enum ('5w2h', 'ishikawa', 'raci', 'eisenhower', 'ooda');
exception when duplicate_object then null;
end $$;

create table if not exists toolbox_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  tool_type toolbox_tool_type not null,
  title text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists toolbox_entries_user_id_idx on toolbox_entries(user_id);
create index if not exists toolbox_entries_project_id_idx on toolbox_entries(project_id);
create index if not exists toolbox_entries_tool_type_idx on toolbox_entries(tool_type);

alter table toolbox_entries enable row level security;

drop policy if exists "Users manage own toolbox entries" on toolbox_entries;
create policy "Users manage own toolbox entries" on toolbox_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
