alter table business_designs
  add column if not exists visual_map jsonb not null default '{"nodes":[],"links":[]}'::jsonb;
