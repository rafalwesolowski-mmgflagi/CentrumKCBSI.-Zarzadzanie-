-- Depends on supabase/migrations/202607010001_wellbeing.sql.
-- Run the base wellbeing migration first because this file references wellbeing_reflections.

create table if not exists wellbeing_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_at timestamptz not null default now(),
  score integer not null default 0,
  answers jsonb not null default '{}'::jsonb,
  summary text,
  created_at timestamptz not null default now(),
  constraint wellbeing_assessments_score_check check (score between 0 and 100)
);

create table if not exists wellbeing_affirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reflection_id uuid references wellbeing_reflections(id) on delete set null,
  text text not null,
  source text not null default 'manual',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wellbeing_affirmations_text_not_blank check (length(trim(text)) > 0),
  constraint wellbeing_affirmations_source_check check (source in ('manual', 'reflection', 'assessment', 'ebook'))
);

create index if not exists wellbeing_assessments_user_id_idx on wellbeing_assessments(user_id);
create index if not exists wellbeing_assessments_taken_at_idx on wellbeing_assessments(taken_at desc);
create index if not exists wellbeing_affirmations_user_id_idx on wellbeing_affirmations(user_id);
create index if not exists wellbeing_affirmations_active_idx on wellbeing_affirmations(is_active);

alter table wellbeing_assessments enable row level security;
alter table wellbeing_affirmations enable row level security;

drop policy if exists "Users manage own wellbeing assessments" on wellbeing_assessments;
create policy "Users manage own wellbeing assessments" on wellbeing_assessments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own wellbeing affirmations" on wellbeing_affirmations;
create policy "Users manage own wellbeing affirmations" on wellbeing_affirmations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
