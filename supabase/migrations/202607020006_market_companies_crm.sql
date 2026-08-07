-- CRM tracking columns on market_companies
alter table market_companies
  add column if not exists crm_status text not null default 'new',
  add column if not exists crm_notes text;
