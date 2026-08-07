alter table ai_sessions
  drop constraint if exists ai_sessions_mode_check;

alter table ai_sessions
  add constraint ai_sessions_mode_check
  check (mode in ('quick-add', 'portfolio-scan', 'business-analysis'));
