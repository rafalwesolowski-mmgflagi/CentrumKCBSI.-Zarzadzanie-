create table if not exists wellbeing_daily_commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  commitment_date date not null default current_date,
  title text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wellbeing_daily_commitments_title_not_blank check (length(trim(title)) > 0),
  constraint wellbeing_daily_commitments_unique_day unique (user_id, commitment_date)
);

create index if not exists wellbeing_daily_commitments_user_id_idx on wellbeing_daily_commitments(user_id);
create index if not exists wellbeing_daily_commitments_date_idx on wellbeing_daily_commitments(commitment_date desc);
create index if not exists wellbeing_daily_commitments_completed_idx on wellbeing_daily_commitments(completed);

alter table wellbeing_daily_commitments enable row level security;

drop policy if exists "Users manage own wellbeing daily commitments" on wellbeing_daily_commitments;
create policy "Users manage own wellbeing daily commitments" on wellbeing_daily_commitments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
