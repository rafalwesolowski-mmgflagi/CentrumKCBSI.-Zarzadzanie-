-- Fala 3: report type + pricing summary

alter table market_reports
  add column if not exists report_type text not null default 'services';

create table if not exists market_pricing_summary (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references market_reports(id) on delete cascade unique,
  price_min_text text,
  price_max_text text,
  price_common_range text,
  price_source_count integer not null default 0,
  outliers text[] not null default '{}',
  claude_summary text,
  sources text[] not null default '{}',
  confidence market_confidence not null default 'low',
  created_at timestamptz not null default now()
);

alter table market_pricing_summary enable row level security;

drop policy if exists "owner via report" on market_pricing_summary;
create policy "owner via report" on market_pricing_summary for all
  using (exists (select 1 from market_reports r where r.id = report_id and r.user_id = auth.uid()));
