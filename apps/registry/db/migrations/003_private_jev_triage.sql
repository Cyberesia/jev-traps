-- Optional operator-triggered triage. No automatic publication or status change.
alter table submissions add column if not exists jev_triage jsonb;
alter table submissions add column if not exists triaged_at timestamptz;
