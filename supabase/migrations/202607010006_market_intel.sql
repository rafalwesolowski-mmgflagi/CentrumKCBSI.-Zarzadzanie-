-- AI Market Intelligence module for Centrum

do $$ begin
  create type market_report_status as enum ('pending', 'in_progress', 'done', 'partial', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type market_confidence as enum ('high', 'medium', 'low');
exception when duplicate_object then null;
end $$;

create table if not exists market_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  industry text not null,
  region text not null,
  status market_report_status not null default 'pending',
  cost_limit_pln numeric(10,2),
  total_cost_usd numeric(10,4) default 0,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists market_companies (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references market_reports(id) on delete cascade,
  place_id text not null,
  name text not null,
  address text,
  phone text,
  website_url text,
  google_rating numeric(2,1),
  review_count integer,
  maps_url text not null,
  opportunity_score numeric(4,1),
  score_reason text,
  created_at timestamptz not null default now(),
  unique (report_id, place_id)
);

create table if not exists market_website_analysis (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references market_companies(id) on delete cascade unique,
  has_website boolean not null default false,
  ssl boolean,
  pagespeed_mobile integer,
  pagespeed_desktop integer,
  cms text,
  has_contact_form boolean,
  has_cta boolean,
  has_blog boolean,
  reachable boolean,
  error_note text,
  source_url text,
  created_at timestamptz not null default now()
);

create table if not exists market_review_insights (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references market_reports(id) on delete cascade,
  category text not null,
  percentage numeric(5,2) not null,
  review_count integer not null default 0,
  sample_quotes text[] not null default '{}',
  sources text[] not null default '{}',
  confidence market_confidence not null default 'medium',
  low_confidence_note text,
  created_at timestamptz not null default now()
);

create table if not exists market_estimates (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references market_reports(id) on delete cascade unique,
  value_low_pln numeric(14,0),
  value_high_pln numeric(14,0),
  confidence market_confidence not null default 'low',
  rationale text not null,
  market_gaps text[] not null default '{}',
  sources text[] not null default '{}',
  low_confidence_note text,
  created_at timestamptz not null default now()
);

create table if not exists market_report_sections (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references market_reports(id) on delete cascade,
  section_key text not null,
  status market_report_status not null default 'pending',
  items_total integer default 0,
  items_done integer default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  unique (report_id, section_key)
);

create index if not exists market_reports_user_id_idx on market_reports(user_id);
create index if not exists market_companies_report_id_idx on market_companies(report_id);
create index if not exists market_companies_score_idx on market_companies(opportunity_score desc nulls last);
create index if not exists market_review_insights_report_id_idx on market_review_insights(report_id);
create index if not exists market_report_sections_report_id_idx on market_report_sections(report_id);

alter table market_reports enable row level security;
alter table market_companies enable row level security;
alter table market_website_analysis enable row level security;
alter table market_review_insights enable row level security;
alter table market_estimates enable row level security;
alter table market_report_sections enable row level security;

drop policy if exists "owner" on market_reports;
create policy "owner" on market_reports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner via report" on market_companies;
create policy "owner via report" on market_companies for all
  using (exists (select 1 from market_reports r where r.id = report_id and r.user_id = auth.uid()));

drop policy if exists "owner via company" on market_website_analysis;
create policy "owner via company" on market_website_analysis for all
  using (exists (
    select 1 from market_companies c join market_reports r on r.id = c.report_id
    where c.id = company_id and r.user_id = auth.uid()
  ));

drop policy if exists "owner via report" on market_review_insights;
create policy "owner via report" on market_review_insights for all
  using (exists (select 1 from market_reports r where r.id = report_id and r.user_id = auth.uid()));

drop policy if exists "owner via report" on market_estimates;
create policy "owner via report" on market_estimates for all
  using (exists (select 1 from market_reports r where r.id = report_id and r.user_id = auth.uid()));

drop policy if exists "owner via report" on market_report_sections;
create policy "owner via report" on market_report_sections for all
  using (exists (select 1 from market_reports r where r.id = report_id and r.user_id = auth.uid()));
