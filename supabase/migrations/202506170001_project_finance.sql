alter table projects
  add column if not exists budget numeric(12, 2),
  add column if not exists invoiced numeric(12, 2),
  add column if not exists paid numeric(12, 2),
  add column if not exists cost numeric(12, 2),
  add column if not exists currency text not null default 'PLN';
