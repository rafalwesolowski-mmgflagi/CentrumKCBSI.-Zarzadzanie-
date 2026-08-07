create table if not exists project_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  title text,
  body text not null,
  is_urgent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_notes_body_not_blank check (length(trim(body)) > 0)
);

create index if not exists project_notes_user_id_idx on project_notes(user_id);
create index if not exists project_notes_project_id_idx on project_notes(project_id);
create index if not exists project_notes_is_urgent_idx on project_notes(is_urgent);
create index if not exists project_notes_updated_at_idx on project_notes(updated_at desc);

alter table project_notes enable row level security;

drop policy if exists "Users manage own project notes" on project_notes;
create policy "Users manage own project notes" on project_notes
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from projects
      where projects.id = project_notes.project_id
        and projects.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from projects
      where projects.id = project_notes.project_id
        and projects.user_id = auth.uid()
    )
  );
