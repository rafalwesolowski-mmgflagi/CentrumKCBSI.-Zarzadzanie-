create or replace function validate_project_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_project_id is null then
    return new;
  end if;

  if new.parent_project_id = new.id then
    raise exception 'Projekt nie może być własnym nadprojektem.';
  end if;

  if not exists (
    select 1
    from projects parent
    where parent.id = new.parent_project_id
      and parent.user_id = new.user_id
  ) then
    raise exception 'Wybrany nadprojekt nie istnieje albo należy do innego użytkownika.';
  end if;

  if exists (
    with recursive ancestors as (
      select parent.id, parent.parent_project_id
      from projects parent
      where parent.id = new.parent_project_id

      union all

      select next_parent.id, next_parent.parent_project_id
      from projects next_parent
      join ancestors on next_parent.id = ancestors.parent_project_id
    )
    select 1
    from ancestors
    where ancestors.id = new.id
  ) then
    raise exception 'Nie można ustawić podprojektu jako nadprojektu, bo utworzyłoby to pętlę w strukturze.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_project_parent_before_write on projects;

create trigger validate_project_parent_before_write
  before insert or update of parent_project_id, user_id on projects
  for each row execute function validate_project_parent();
