-- Comments are content too. Rebuild both safety tables because SQLite cannot
-- alter a CHECK constraint in place, widening target_type to accept comments.

create table safety_flags_new (
  id text primary key,
  target_type text not null check (target_type in ('entry', 'account', 'comment')),
  target_id text not null,
  target_label text not null,
  author_id text,
  severity text not null check (severity in ('low', 'medium', 'high')),
  categories text not null default '[]',
  matched_terms text not null default '[]',
  excerpt text not null default '',
  explanation text,
  provider text not null default 'local',
  content_hash text not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  reviewed_by text,
  reviewed_at integer,
  created_at integer not null,
  updated_at integer not null
);

insert into safety_flags_new
  (id, target_type, target_id, target_label, author_id, severity, categories,
   matched_terms, excerpt, explanation, provider, content_hash, status,
   reviewed_by, reviewed_at, created_at, updated_at)
select
  id, target_type, target_id, target_label, author_id, severity, categories,
  matched_terms, excerpt, explanation, provider, content_hash, status,
  reviewed_by, reviewed_at, created_at, updated_at
from safety_flags;

drop table safety_flags;
alter table safety_flags_new rename to safety_flags;

create unique index safety_flags_target_uq on safety_flags (target_type, target_id);
create index safety_flags_status_idx on safety_flags (status, severity, updated_at);

create table safety_checks_new (
  target_type text not null check (target_type in ('entry', 'account', 'comment')),
  target_id text not null,
  content_hash text not null,
  provider text not null,
  severity text not null check (severity in ('none', 'low', 'medium', 'high')),
  scanned_at integer not null,
  primary key (target_type, target_id)
);

insert into safety_checks_new
  (target_type, target_id, content_hash, provider, severity, scanned_at)
select target_type, target_id, content_hash, provider, severity, scanned_at
from safety_checks;

drop table safety_checks;
alter table safety_checks_new rename to safety_checks;

create index safety_checks_scanned_idx on safety_checks (scanned_at);
