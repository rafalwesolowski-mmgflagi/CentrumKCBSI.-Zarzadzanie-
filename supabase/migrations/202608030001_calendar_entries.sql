do $$
begin
  if not exists (select 1 from pg_type where typname = 'calendar_entry_kind') then
    create type calendar_entry_kind as enum ('event', 'note');
  end if;
end $$;

create table if not exists calendar_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  kind calendar_entry_kind not null default 'event',
  title text not null,
  entry_date date not null,
  start_time time,
  end_time time,
  is_all_day boolean not null default false,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_entries_title_not_blank check (length(trim(title)) > 0),
  constraint calendar_entries_time_order check (
    start_time is null
    or end_time is null
    or end_time >= start_time
  )
);

create index if not exists calendar_entries_user_date_idx on calendar_entries(user_id, entry_date asc);
create index if not exists calendar_entries_project_id_idx on calendar_entries(project_id);
create index if not exists calendar_entries_kind_idx on calendar_entries(kind);

alter table calendar_entries enable row level security;

drop policy if exists "Users manage own calendar entries" on calendar_entries;
create policy "Users manage own calendar entries" on calendar_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
