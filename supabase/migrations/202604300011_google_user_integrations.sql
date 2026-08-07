create table if not exists google_user_integrations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text,
  refresh_token text not null,
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists google_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);

create index if not exists google_oauth_states_user_id_idx on google_oauth_states(user_id);
create index if not exists google_oauth_states_expires_at_idx on google_oauth_states(expires_at);

alter table google_user_integrations enable row level security;
alter table google_oauth_states enable row level security;

drop policy if exists "No direct google integration access" on google_user_integrations;
create policy "No direct google integration access" on google_user_integrations
  for all
  using (false)
  with check (false);

drop policy if exists "No direct google oauth state access" on google_oauth_states;
create policy "No direct google oauth state access" on google_oauth_states
  for all
  using (false)
  with check (false);
