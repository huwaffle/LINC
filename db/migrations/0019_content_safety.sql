-- Content-safety findings produced by Gemini (with a local lexicon fallback)
-- for posts and accounts. One open row per target keeps the admin queue tidy.
create table if not exists safety_flags (
  id text primary key,
  target_type text not null check (target_type in ('entry', 'account')),
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

create unique index if not exists safety_flags_target_uq on safety_flags (target_type, target_id);
create index if not exists safety_flags_status_idx on safety_flags (status, severity, updated_at);

-- One row per bulk scan so the console can show when it last ran.
create table if not exists safety_scans (
  id text primary key,
  scanned_count integer not null,
  flagged_count integer not null,
  provider text not null,
  created_at integer not null
);
