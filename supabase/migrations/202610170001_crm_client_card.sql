-- CRM: karta klienta (dane firmy, osoby kontaktowe, oś czasu aktywności)

alter table crm_clients
  add column if not exists website text,
  add column if not exists address text,
  add column if not exists tax_id text,
  add column if not exists price_group text,
  add column if not exists bank_account text,
  add column if not exists next_contact_reminder timestamptz,
  add column if not exists invoice_note text;

create table if not exists crm_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  full_name text not null,
  position text,
  phones text[] not null default '{}',
  emails text[] not null default '{}',
  status text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_contacts_name_not_blank check (length(trim(full_name)) > 0)
);

create index if not exists crm_contacts_user_id_idx on crm_contacts(user_id);
create index if not exists crm_contacts_client_id_idx on crm_contacts(client_id);

alter table crm_contacts enable row level security;

drop policy if exists "Users manage own CRM contacts" on crm_contacts;
create policy "Users manage own CRM contacts" on crm_contacts
  for all
  using (
    auth.uid() = user_id
    and exists (select 1 from crm_clients where crm_clients.id = crm_contacts.client_id and crm_clients.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from crm_clients where crm_clients.id = crm_contacts.client_id and crm_clients.user_id = auth.uid())
  );

create table if not exists crm_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  contact_id uuid references crm_contacts(id) on delete set null,
  kind text not null,
  title text not null,
  body text,
  direction text,
  counterpart text,
  reference text,
  amount numeric(12, 2),
  currency text not null default 'PLN',
  status text,
  url text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_activities_title_not_blank check (length(trim(title)) > 0),
  constraint crm_activities_kind_check check (kind in ('email', 'note', 'order', 'invoice', 'offer', 'opportunity', 'file', 'warehouse', 'reminder', 'call', 'meeting', 'change')),
  constraint crm_activities_direction_check check (direction is null or direction in ('in', 'out')),
  constraint crm_activities_status_check check (status is null or status in ('open', 'done'))
);

create index if not exists crm_activities_user_id_idx on crm_activities(user_id);
create index if not exists crm_activities_client_id_idx on crm_activities(client_id, occurred_at desc);

alter table crm_activities enable row level security;

drop policy if exists "Users manage own CRM activities" on crm_activities;
create policy "Users manage own CRM activities" on crm_activities
  for all
  using (
    auth.uid() = user_id
    and exists (select 1 from crm_clients where crm_clients.id = crm_activities.client_id and crm_clients.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from crm_clients where crm_clients.id = crm_activities.client_id and crm_clients.user_id = auth.uid())
  );
