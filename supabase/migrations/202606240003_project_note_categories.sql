alter table project_notes
  add column if not exists category text not null default 'general',
  add column if not exists source text not null default 'written';

alter table project_notes
  drop constraint if exists project_notes_category_check,
  add constraint project_notes_category_check
    check (category in ('general', 'decision', 'idea', 'risk', 'meeting', 'finance', 'crm', 'task', 'research'));

alter table project_notes
  drop constraint if exists project_notes_source_check,
  add constraint project_notes_source_check
    check (source in ('written', 'voice'));

create index if not exists project_notes_category_idx on project_notes(category);
create index if not exists project_notes_source_idx on project_notes(source);
