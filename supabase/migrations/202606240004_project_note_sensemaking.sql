alter table project_notes
  add column if not exists review_status text not null default 'inbox',
  add column if not exists summary text,
  add column if not exists tags text[] not null default '{}';

alter table project_notes
  drop constraint if exists project_notes_review_status_check,
  add constraint project_notes_review_status_check
    check (review_status in ('inbox', 'reviewed', 'action'));

create index if not exists project_notes_review_status_idx on project_notes(review_status);
create index if not exists project_notes_tags_idx on project_notes using gin(tags);
