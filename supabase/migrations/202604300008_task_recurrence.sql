alter table tasks
  add column if not exists recurrence text
    check (recurrence in ('daily', 'weekly', 'biweekly', 'monthly'));

create index if not exists tasks_recurrence_idx on tasks(recurrence) where recurrence is not null;
