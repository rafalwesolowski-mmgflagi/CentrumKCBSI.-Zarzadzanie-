-- Execution OS / Mission Engine for Centrum

do $$ begin
  create type mission_path_type as enum ('do_it_now', 'tactical_sprint', 'life_os');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type mission_mode as enum ('guided', 'full');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type mission_status as enum ('active', 'paused', 'completed', 'abandoned', 'quick_win');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type mission_stage_status as enum ('locked', 'pending', 'in_progress', 'passed', 'blocked');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type mission_task_status as enum ('todo', 'in_progress', 'done');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type mission_decision_type as enum ('approve', 'revise', 'block', 'escalate');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type mission_impact as enum ('low', 'medium', 'high');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type mission_assumption_status as enum ('open', 'validated', 'invalidated');
exception when duplicate_object then null;
end $$;

create or replace function public.execution_is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false);
$$;

create table if not exists mission_processes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null default 1,
  description text,
  definition jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, version)
);

create table if not exists mission_process_stages (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references mission_processes(id) on delete cascade,
  stage_order integer not null,
  stage_key text not null,
  name text not null,
  description text,
  entry_criteria jsonb not null default '{}',
  exit_criteria jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (process_id, stage_key),
  unique (process_id, stage_order)
);

create table if not exists mission_process_gates (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references mission_process_stages(id) on delete cascade,
  gate_key text not null,
  name text not null,
  checklist jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (stage_id, gate_key)
);

create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  process_id uuid not null references mission_processes(id),
  title text not null,
  raw_goal text not null,
  path_type mission_path_type,
  mode mission_mode not null default 'guided',
  status mission_status not null default 'active',
  current_stage_id uuid references mission_process_stages(id),
  resource_profile jsonb not null default '{}',
  gap_score jsonb not null default '{}',
  ai_context jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mission_stage_runs (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions(id) on delete cascade,
  stage_id uuid not null references mission_process_stages(id) on delete cascade,
  status mission_stage_status not null default 'locked',
  items_total integer not null default 0,
  items_done integer not null default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mission_id, stage_id)
);

create table if not exists mission_tasks (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions(id) on delete cascade,
  stage_id uuid references mission_process_stages(id),
  title text not null,
  description text,
  status mission_task_status not null default 'todo',
  is_micro_step boolean not null default false,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists mission_tasks_one_open_micro_step_idx
  on mission_tasks (mission_id)
  where is_micro_step = true and status <> 'done';

create table if not exists mission_decisions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions(id) on delete cascade,
  gate_id uuid references mission_process_gates(id),
  decision_type mission_decision_type not null,
  confidence integer not null check (confidence between 0 and 100),
  impact mission_impact not null default 'medium',
  reversible boolean not null default true,
  owner_id uuid references auth.users(id),
  rationale text not null,
  created_at timestamptz not null default now()
);

create table if not exists mission_evidence (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references mission_decisions(id) on delete cascade,
  content jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists mission_assumptions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions(id) on delete cascade,
  description text not null,
  confidence integer not null check (confidence between 0 and 100),
  status mission_assumption_status not null default 'open',
  evidence jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists missions_owner_id_idx on missions(owner_id);
create index if not exists missions_status_idx on missions(status);
create index if not exists mission_stage_runs_mission_id_idx on mission_stage_runs(mission_id);
create index if not exists mission_tasks_mission_id_idx on mission_tasks(mission_id);
create index if not exists mission_decisions_mission_id_idx on mission_decisions(mission_id);
create index if not exists mission_assumptions_mission_id_idx on mission_assumptions(mission_id);

alter table mission_processes enable row level security;
alter table mission_process_stages enable row level security;
alter table mission_process_gates enable row level security;
alter table missions enable row level security;
alter table mission_stage_runs enable row level security;
alter table mission_tasks enable row level security;
alter table mission_decisions enable row level security;
alter table mission_evidence enable row level security;
alter table mission_assumptions enable row level security;

drop policy if exists "authenticated can read active processes" on mission_processes;
create policy "authenticated can read active processes" on mission_processes
  for select using (auth.role() = 'authenticated' and is_active = true);

drop policy if exists "authenticated can read process stages" on mission_process_stages;
create policy "authenticated can read process stages" on mission_process_stages
  for select using (
    auth.role() = 'authenticated'
    and exists (select 1 from mission_processes p where p.id = process_id and p.is_active = true)
  );

drop policy if exists "authenticated can read process gates" on mission_process_gates;
create policy "authenticated can read process gates" on mission_process_gates
  for select using (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from mission_process_stages s
      join mission_processes p on p.id = s.process_id
      where s.id = stage_id and p.is_active = true
    )
  );

drop policy if exists "owner or admin" on missions;
create policy "owner or admin" on missions for all
  using (owner_id = auth.uid() or public.execution_is_admin())
  with check (owner_id = auth.uid() or public.execution_is_admin());

drop policy if exists "owner via mission" on mission_stage_runs;
create policy "owner via mission" on mission_stage_runs for all
  using (exists (select 1 from missions m where m.id = mission_id and (m.owner_id = auth.uid() or public.execution_is_admin())))
  with check (exists (select 1 from missions m where m.id = mission_id and (m.owner_id = auth.uid() or public.execution_is_admin())));

drop policy if exists "owner via mission" on mission_tasks;
create policy "owner via mission" on mission_tasks for all
  using (exists (select 1 from missions m where m.id = mission_id and (m.owner_id = auth.uid() or public.execution_is_admin())))
  with check (exists (select 1 from missions m where m.id = mission_id and (m.owner_id = auth.uid() or public.execution_is_admin())));

drop policy if exists "owner via mission" on mission_decisions;
create policy "owner via mission" on mission_decisions for all
  using (exists (select 1 from missions m where m.id = mission_id and (m.owner_id = auth.uid() or public.execution_is_admin())))
  with check (exists (select 1 from missions m where m.id = mission_id and (m.owner_id = auth.uid() or public.execution_is_admin())));

drop policy if exists "owner via decision" on mission_evidence;
create policy "owner via decision" on mission_evidence for all
  using (exists (
    select 1
    from mission_decisions d
    join missions m on m.id = d.mission_id
    where d.id = decision_id and (m.owner_id = auth.uid() or public.execution_is_admin())
  ))
  with check (exists (
    select 1
    from mission_decisions d
    join missions m on m.id = d.mission_id
    where d.id = decision_id and (m.owner_id = auth.uid() or public.execution_is_admin())
  ));

drop policy if exists "owner via mission" on mission_assumptions;
create policy "owner via mission" on mission_assumptions for all
  using (exists (select 1 from missions m where m.id = mission_id and (m.owner_id = auth.uid() or public.execution_is_admin())))
  with check (exists (select 1 from missions m where m.id = mission_id and (m.owner_id = auth.uid() or public.execution_is_admin())));

insert into mission_processes (name, version, description, definition)
values (
  'goal_execution',
  1,
  'Execution OS MVP: triage to roadmap to micro step.',
  '{"gap_dimensions":["knowledge","money","time","people","risk","execution"],"confidence_threshold":60}'::jsonb
)
on conflict (name, version) do update
set description = excluded.description,
    definition = excluded.definition,
    is_active = true;

with process as (
  select id from mission_processes where name = 'goal_execution' and version = 1
), stages(stage_order, stage_key, name, description, entry_criteria, exit_criteria) as (
  values
    (1, 'triage', 'Triaż i Test Prawdy', 'Klasyfikacja celu: DO IT NOW, Tactical Sprint albo Life OS.', '{}'::jsonb, '{"requires":["path_type","cost_acknowledgement"]}'::jsonb),
    (2, 'resources', 'Diagnoza zasobów', 'Budżet, czas, zespół, kompetencje, ograniczenia, przewagi i ryzyka.', '{"requires":["triage_passed"]}'::jsonb, '{"requires":["budget","time","people","skills","constraints","advantages","risks"]}'::jsonb),
    (3, 'calibration', 'Kalibracja', 'Gap jako wektor i dopasowanie szkieletu procesu.', '{"requires":["resource_profile"]}'::jsonb, '{"requires":["gap_score","dominant_gap","process_adjustments"]}'::jsonb),
    (4, 'strategy', 'Strategia i koszt', 'Wybór ścieżki, deklaracja kosztu i założenia.', '{"requires":["gap_score"]}'::jsonb, '{"requires":["cost_declaration","assumptions"]}'::jsonb),
    (5, 'critique', 'Moduł Krytyki', 'Stress-test roadmapy i fallbacki.', '{"requires":["strategy"]}'::jsonb, '{"requires":["weaknesses","fallbacks"]}'::jsonb),
    (6, 'roadmap', 'Roadmapa', 'Etapy, bramki i zależności widoczne w trybie pełnym lub prowadzonym.', '{"requires":["critique_passed"]}'::jsonb, '{"requires":["accepted_roadmap"]}'::jsonb),
    (7, 'micro_step', 'Śmiesznie Mały Krok', 'Jedno zadanie wykonalne od razu w mniej niż 15 minut.', '{"requires":["roadmap"]}'::jsonb, '{"requires":["micro_step"]}'::jsonb)
)
insert into mission_process_stages (process_id, stage_order, stage_key, name, description, entry_criteria, exit_criteria)
select process.id, stages.stage_order, stages.stage_key, stages.name, stages.description, stages.entry_criteria, stages.exit_criteria
from process, stages
on conflict (process_id, stage_key) do update
set stage_order = excluded.stage_order,
    name = excluded.name,
    description = excluded.description,
    entry_criteria = excluded.entry_criteria,
    exit_criteria = excluded.exit_criteria;

insert into mission_process_gates (stage_id, gate_key, name, checklist)
select s.id, s.stage_key || '_gate', s.name || ' — Gate', s.exit_criteria -> 'requires'
from mission_process_stages s
join mission_processes p on p.id = s.process_id
where p.name = 'goal_execution' and p.version = 1
on conflict (stage_id, gate_key) do update
set name = excluded.name,
    checklist = excluded.checklist;
