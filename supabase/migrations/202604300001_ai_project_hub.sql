create extension if not exists "pgcrypto";

create type project_status as enum ('on_track', 'in_progress', 'at_risk', 'paused', 'done');
create type task_status as enum ('backlog', 'in_progress', 'review', 'done');
create type task_priority as enum ('low', 'medium', 'high', 'critical');
create type task_impact as enum ('low', 'medium', 'high', 'strategic');
create type risk_status as enum ('none', 'watch', 'risk', 'blocked');

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#57c7ff',
  status project_status not null default 'in_progress',
  created_at timestamptz not null default now()
);

create table phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  constraint phase_dates_valid check (end_date >= start_date)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references phases(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  status task_status not null default 'backlog',
  due_date date not null,
  priority task_priority not null default 'medium',
  impact task_impact not null default 'medium',
  deadline_importance integer not null default 0,
  risk_status risk_status not null default 'none',
  assignee text,
  created_at timestamptz not null default now()
);

create table ai_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  response_json jsonb not null,
  mode text not null check (mode in ('quick-add', 'portfolio-scan')),
  created_at timestamptz not null default now()
);

create index projects_user_id_idx on projects(user_id);
create index phases_project_id_idx on phases(project_id);
create index tasks_project_id_idx on tasks(project_id);
create index tasks_phase_id_idx on tasks(phase_id);
create index tasks_due_date_idx on tasks(due_date);
create index tasks_risk_status_idx on tasks(risk_status);
create index ai_sessions_user_id_idx on ai_sessions(user_id);

alter table projects enable row level security;
alter table phases enable row level security;
alter table tasks enable row level security;
alter table ai_sessions enable row level security;

create policy "Users manage own projects" on projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own phases" on phases
  for all
  using (
    exists (
      select 1
      from projects
      where projects.id = phases.project_id
        and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from projects
      where projects.id = phases.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "Users manage own tasks" on tasks
  for all
  using (
    exists (
      select 1
      from projects
      where projects.id = tasks.project_id
        and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from projects
      where projects.id = tasks.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "Users manage own ai sessions" on ai_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
