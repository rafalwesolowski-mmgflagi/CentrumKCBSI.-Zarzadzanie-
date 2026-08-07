alter table tasks
  add column if not exists completed_at timestamptz;

create index if not exists tasks_completed_at_idx on tasks(completed_at) where completed_at is not null;
