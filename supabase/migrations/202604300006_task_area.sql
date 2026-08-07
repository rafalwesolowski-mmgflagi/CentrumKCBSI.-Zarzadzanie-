alter table tasks
  add column if not exists area text;

create index if not exists tasks_area_idx on tasks(area);
