-- Counters only: no URLs, page contents, IP addresses or scan results.
create table if not exists scan_daily_usage (
  day date primary key,
  attempts integer not null check (attempts > 0)
);
