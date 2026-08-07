create table if not exists crm_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  company text not null,
  contact_name text,
  email text,
  phone text,
  stage text not null default 'lead',
  value numeric(12, 2),
  currency text not null default 'PLN',
  next_follow_up date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_clients_company_not_blank check (length(trim(company)) > 0),
  constraint crm_clients_stage_check check (stage in ('lead', 'qualified', 'active', 'follow_up', 'paused', 'closed')),
  constraint crm_clients_value_non_negative check (value is null or value >= 0)
);

create index if not exists crm_clients_user_id_idx on crm_clients(user_id);
create index if not exists crm_clients_project_id_idx on crm_clients(project_id);
create index if not exists crm_clients_stage_idx on crm_clients(stage);
create index if not exists crm_clients_next_follow_up_idx on crm_clients(next_follow_up);

alter table crm_clients enable row level security;

drop policy if exists "Users manage own CRM clients" on crm_clients;
create policy "Users manage own CRM clients" on crm_clients
  for all
  using (
    auth.uid() = user_id
    and (
      project_id is null
      or exists (
        select 1
        from projects
        where projects.id = crm_clients.project_id
          and projects.user_id = auth.uid()
      )
    )
  )
  with check (
    auth.uid() = user_id
    and (
      project_id is null
      or exists (
        select 1
        from projects
        where projects.id = crm_clients.project_id
          and projects.user_id = auth.uid()
      )
    )
  );
