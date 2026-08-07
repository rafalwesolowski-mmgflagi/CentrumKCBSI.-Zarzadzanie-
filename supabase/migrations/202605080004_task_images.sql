create table if not exists task_images (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  data_url text not null,
  created_at timestamptz not null default now(),
  constraint task_images_mime_type_image check (mime_type like 'image/%'),
  constraint task_images_size_reasonable check (size_bytes > 0 and size_bytes <= 2097152)
);

create index if not exists task_images_task_id_idx on task_images(task_id);
create index if not exists task_images_user_id_idx on task_images(user_id);
create index if not exists task_images_created_at_idx on task_images(created_at desc);

alter table task_images enable row level security;

drop policy if exists "Users manage own task images" on task_images;
create policy "Users manage own task images" on task_images
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from tasks
      join projects on projects.id = tasks.project_id
      where tasks.id = task_images.task_id
        and projects.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from tasks
      join projects on projects.id = tasks.project_id
      where tasks.id = task_images.task_id
        and projects.user_id = auth.uid()
    )
  );
