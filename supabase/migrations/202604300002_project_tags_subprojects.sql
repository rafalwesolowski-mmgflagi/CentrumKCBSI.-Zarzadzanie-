alter table projects
  add column if not exists tags text[] not null default '{}',
  add column if not exists parent_project_id uuid references projects(id) on delete set null;

create index if not exists projects_parent_project_id_idx on projects(parent_project_id);
create index if not exists projects_tags_idx on projects using gin(tags);

alter table projects
  drop constraint if exists projects_not_own_parent,
  add constraint projects_not_own_parent check (parent_project_id is null or parent_project_id <> id);
