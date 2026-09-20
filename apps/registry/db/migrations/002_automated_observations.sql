-- Aggregated, evidence-free observations published by configured Jev Traps SDKs.
-- These are explicitly NOT reviewed registry evidence and must remain visually
-- and semantically separate from curated entries in data/registry.json.

create table if not exists automated_observations (
  id uuid primary key,
  url text not null unique,
  domain text not null,
  observations integer not null default 1 check (observations > 0),
  max_risk double precision not null check (max_risk >= 0 and max_risk <= 1),
  actions text[] not null,
  trap_types text[] not null,
  detector_versions text[] not null,
  surfaces text[] not null,
  first_seen timestamptz not null,
  last_seen timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists automated_observations_last_seen
  on automated_observations (last_seen desc);
