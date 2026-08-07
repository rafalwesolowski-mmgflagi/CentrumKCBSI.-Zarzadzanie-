alter table crm_clients
  add column if not exists project_url text,
  add column if not exists repository_url text,
  add column if not exists advance_payment numeric(12,2);
