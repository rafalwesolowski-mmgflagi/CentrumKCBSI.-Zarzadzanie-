alter table projects
  add column if not exists areas text[] not null default '{}';

create index if not exists projects_areas_idx on projects using gin(areas);
