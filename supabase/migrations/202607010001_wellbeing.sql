create table if not exists wellbeing_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  horizon text not null default 'short_term',
  status text not null default 'active',
  description text,
  success_criteria text,
  target_date date,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wellbeing_goals_title_not_blank check (length(trim(title)) > 0),
  constraint wellbeing_goals_horizon_check check (horizon in ('short_term', 'long_term')),
  constraint wellbeing_goals_status_check check (status in ('active', 'paused', 'done', 'archived'))
);

create table if not exists wellbeing_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references wellbeing_goals(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  entry_date date not null default current_date,
  mood integer,
  energy integer,
  gratitude text,
  wins text,
  challenge text,
  lesson text,
  next_step text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wellbeing_reflections_mood_check check (mood is null or mood between 1 and 5),
  constraint wellbeing_reflections_energy_check check (energy is null or energy between 1 and 5)
);

create table if not exists wellbeing_rewirement_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_key text not null,
  title text not null,
  description text,
  start_date date not null default current_date,
  end_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wellbeing_rewirement_title_not_blank check (length(trim(title)) > 0),
  constraint wellbeing_rewirement_status_check check (status in ('active', 'paused', 'done', 'archived'))
);

create table if not exists wellbeing_rewirement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references wellbeing_rewirement_challenges(id) on delete cascade,
  log_date date not null default current_date,
  completed boolean not null default false,
  note text,
  value integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wellbeing_rewirement_logs_value_check check (value is null or value between 0 and 100),
  constraint wellbeing_rewirement_logs_unique_day unique (challenge_id, log_date)
);

create index if not exists wellbeing_goals_user_id_idx on wellbeing_goals(user_id);
create index if not exists wellbeing_goals_project_id_idx on wellbeing_goals(project_id);
create index if not exists wellbeing_goals_horizon_idx on wellbeing_goals(horizon);
create index if not exists wellbeing_goals_status_idx on wellbeing_goals(status);
create index if not exists wellbeing_goals_tags_idx on wellbeing_goals using gin(tags);

create index if not exists wellbeing_reflections_user_id_idx on wellbeing_reflections(user_id);
create index if not exists wellbeing_reflections_entry_date_idx on wellbeing_reflections(entry_date desc);
create index if not exists wellbeing_reflections_goal_id_idx on wellbeing_reflections(goal_id);
create index if not exists wellbeing_reflections_tags_idx on wellbeing_reflections using gin(tags);

create index if not exists wellbeing_rewirement_challenges_user_id_idx on wellbeing_rewirement_challenges(user_id);
create index if not exists wellbeing_rewirement_logs_challenge_id_idx on wellbeing_rewirement_logs(challenge_id);
create index if not exists wellbeing_rewirement_logs_log_date_idx on wellbeing_rewirement_logs(log_date desc);

alter table wellbeing_goals enable row level security;
alter table wellbeing_reflections enable row level security;
alter table wellbeing_rewirement_challenges enable row level security;
alter table wellbeing_rewirement_logs enable row level security;

drop policy if exists "Users manage own wellbeing goals" on wellbeing_goals;
create policy "Users manage own wellbeing goals" on wellbeing_goals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own wellbeing reflections" on wellbeing_reflections;
create policy "Users manage own wellbeing reflections" on wellbeing_reflections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own wellbeing rewirement challenges" on wellbeing_rewirement_challenges;
create policy "Users manage own wellbeing rewirement challenges" on wellbeing_rewirement_challenges
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own wellbeing rewirement logs" on wellbeing_rewirement_logs;
create policy "Users manage own wellbeing rewirement logs" on wellbeing_rewirement_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
