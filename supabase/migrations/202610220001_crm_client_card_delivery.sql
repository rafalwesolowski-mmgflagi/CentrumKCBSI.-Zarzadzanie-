-- CRM: karta klienta - adresy dostawy, adresy w kopii (CC) i język przypomnień

alter table crm_clients
  add column if not exists cc_emails text[] not null default '{}',
  add column if not exists reminder_language text,
  add column if not exists delivery_addresses jsonb not null default '[]'::jsonb;

alter table crm_clients
  drop constraint if exists crm_clients_delivery_addresses_array;
alter table crm_clients
  add constraint crm_clients_delivery_addresses_array
  check (jsonb_typeof(delivery_addresses) = 'array');
