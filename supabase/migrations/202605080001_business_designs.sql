create table if not exists business_designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  canvas jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_designs_user_id_idx on business_designs(user_id);
create index if not exists business_designs_project_id_idx on business_designs(project_id);
create index if not exists business_designs_updated_at_idx on business_designs(updated_at desc);

alter table business_designs enable row level security;

drop policy if exists "Users manage own business designs" on business_designs;
create policy "Users manage own business designs" on business_designs
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      project_id is null
      or exists (
        select 1
        from projects
        where projects.id = business_designs.project_id
          and projects.user_id = auth.uid()
      )
    )
  );

create or replace function set_business_designs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists business_designs_set_updated_at on business_designs;
create trigger business_designs_set_updated_at
  before update on business_designs
  for each row
  execute function set_business_designs_updated_at();
