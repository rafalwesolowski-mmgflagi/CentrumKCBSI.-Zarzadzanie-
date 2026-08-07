-- Cold outreach emails generated on-demand by Claude
create table if not exists market_cold_emails (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references market_reports(id) on delete cascade,
  company_id uuid not null references market_companies(id) on delete cascade,
  subject text not null,
  body_text text not null,
  personalization_notes text,
  generated_at timestamptz not null default now()
);

create index if not exists market_cold_emails_report_id_idx on market_cold_emails(report_id);
create index if not exists market_cold_emails_company_id_idx on market_cold_emails(company_id);

alter table market_cold_emails enable row level security;

drop policy if exists "owner via report" on market_cold_emails;
create policy "owner via report" on market_cold_emails for all
  using (exists (select 1 from market_reports r where r.id = report_id and r.user_id = auth.uid()));
