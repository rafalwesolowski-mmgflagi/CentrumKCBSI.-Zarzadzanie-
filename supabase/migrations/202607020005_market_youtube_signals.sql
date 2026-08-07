-- YouTube market signals extracted by Claude from video search results
create table if not exists market_youtube_signals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references market_reports(id) on delete cascade,
  signal_type text not null, -- trending_topic | common_question | market_opportunity
  title text not null,
  description text not null,
  video_count integer,
  example_titles text[] not null default '{}',
  confidence market_confidence not null default 'medium',
  created_at timestamptz not null default now()
);

create index if not exists market_youtube_signals_report_id_idx on market_youtube_signals(report_id);

alter table market_youtube_signals enable row level security;

drop policy if exists "owner via report" on market_youtube_signals;
create policy "owner via report" on market_youtube_signals for all
  using (exists (select 1 from market_reports r where r.id = report_id and r.user_id = auth.uid()));
