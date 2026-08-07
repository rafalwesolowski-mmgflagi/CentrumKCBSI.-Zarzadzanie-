create table if not exists wellbeing_diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wellbeing_diary_entries_body_not_blank check (length(trim(body)) > 0)
);

create index if not exists wellbeing_diary_entries_user_id_idx on wellbeing_diary_entries(user_id);
create index if not exists wellbeing_diary_entries_entry_date_idx on wellbeing_diary_entries(entry_date desc);

alter table wellbeing_diary_entries enable row level security;

drop policy if exists "Users manage own wellbeing diary entries" on wellbeing_diary_entries;
create policy "Users manage own wellbeing diary entries" on wellbeing_diary_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
