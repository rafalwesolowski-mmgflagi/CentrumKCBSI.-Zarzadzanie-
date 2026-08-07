-- AI Market Intelligence — Fala 2: persony klientów + propozycje usług

create table if not exists market_personas (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references market_reports(id) on delete cascade,
  name text not null,
  age_range text,
  role text not null,
  pain_points text[] not null default '{}',
  goals text[] not null default '{}',
  buying_triggers text[] not null default '{}',
  sources text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists market_service_proposals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references market_reports(id) on delete cascade,
  title text not null,
  description text not null,
  target_segment text not null,
  estimated_value_pln numeric(10,0),
  priority integer not null default 1,
  rationale text not null,
  sources text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists market_personas_report_id_idx on market_personas(report_id);
create index if not exists market_service_proposals_report_id_idx on market_service_proposals(report_id);

alter table market_personas enable row level security;
alter table market_service_proposals enable row level security;

drop policy if exists "owner via report" on market_personas;
create policy "owner via report" on market_personas for all
  using (exists (select 1 from market_reports r where r.id = report_id and r.user_id = auth.uid()));

drop policy if exists "owner via report" on market_service_proposals;
create policy "owner via report" on market_service_proposals for all
  using (exists (select 1 from market_reports r where r.id = report_id and r.user_id = auth.uid()));
