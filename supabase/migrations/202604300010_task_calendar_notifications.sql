do $$
begin
  if not exists (select 1 from pg_type where typname = 'calendar_notification_status') then
    create type calendar_notification_status as enum ('pending', 'sent', 'failed');
  end if;
end $$;

create table if not exists task_calendar_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  status calendar_notification_status not null default 'pending',
  workflow text not null default 'n8n-google-calendar',
  request_json jsonb not null default '{}'::jsonb,
  response_json jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists task_calendar_notifications_user_id_idx on task_calendar_notifications(user_id);
create index if not exists task_calendar_notifications_task_id_idx on task_calendar_notifications(task_id);
create index if not exists task_calendar_notifications_status_idx on task_calendar_notifications(status);
create index if not exists task_calendar_notifications_created_at_idx on task_calendar_notifications(created_at desc);

alter table task_calendar_notifications enable row level security;

drop policy if exists "Users read own calendar notifications" on task_calendar_notifications;
create policy "Users read own calendar notifications" on task_calendar_notifications
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users create own calendar notifications" on task_calendar_notifications;
create policy "Users create own calendar notifications" on task_calendar_notifications
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from tasks
      join projects on projects.id = tasks.project_id
      where tasks.id = task_calendar_notifications.task_id
        and projects.user_id = auth.uid()
    )
  );

drop policy if exists "Users update own calendar notifications" on task_calendar_notifications;
create policy "Users update own calendar notifications" on task_calendar_notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
