-- Narzedziownik and work log: keep timestamps and ownership consistent at database level

create index if not exists toolbox_entries_updated_at_idx on toolbox_entries(updated_at desc);

create or replace function set_toolbox_entries_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists toolbox_entries_set_updated_at on toolbox_entries;
create trigger toolbox_entries_set_updated_at
  before update on toolbox_entries
  for each row
  execute function set_toolbox_entries_updated_at();

drop policy if exists "Users manage own toolbox entries" on toolbox_entries;
create policy "Users manage own toolbox entries" on toolbox_entries
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      project_id is null
      or exists (
        select 1
        from projects
        where projects.id = toolbox_entries.project_id
          and projects.user_id = auth.uid()
      )
    )
  );

create index if not exists work_log_entries_updated_at_idx on work_log_entries(updated_at desc);

create or replace function set_work_log_entries_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists work_log_entries_set_updated_at on work_log_entries;
create trigger work_log_entries_set_updated_at
  before update on work_log_entries
  for each row
  execute function set_work_log_entries_updated_at();
