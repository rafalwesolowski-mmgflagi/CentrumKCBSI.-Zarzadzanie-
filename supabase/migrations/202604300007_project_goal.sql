alter table projects
  add column if not exists goal text;

create index if not exists projects_goal_idx on projects(goal) where goal is not null;
