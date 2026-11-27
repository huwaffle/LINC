-- Cache the last scanned content hash per target so an unchanged post or
-- account is not sent to Gemini again on every save. The hash is stored even
-- when the content is clean, which is what makes the skip possible.
create table if not exists safety_checks (
  target_type text not null check (target_type in ('entry', 'account')),
  target_id text not null,
  content_hash text not null,
  provider text not null,
  severity text not null check (severity in ('none', 'low', 'medium', 'high')),
  scanned_at integer not null,
  primary key (target_type, target_id)
);

create index if not exists safety_checks_scanned_idx on safety_checks (scanned_at);

-- How many findings in the last bulk scan were severe enough to alert the
-- administrator (the rest were recorded silently in the console).
alter table safety_scans add column notified_count integer not null default 0;
