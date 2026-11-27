-- LINC initial schema (SQLite)

create table users (
  id text primary key,
  username text not null unique,
  role text not null check (role in ('admin', 'student')),
  display_name text not null,
  is_anonymous integer not null default 0,
  created_at integer not null
);

create table categories (
  id text primary key,
  slug text not null unique,
  label text not null,
  description text not null,
  sort_order integer not null default 0
);

create table entries (
  id text primary key,
  author_id text not null references users(id),
  category_id text not null references categories(id),
  title text not null,
  body text not null,
  status text not null check (status in ('draft', 'pending', 'published', 'rejected', 'redacted')),
  is_anonymous integer not null default 0,
  reject_reason text,
  created_at integer not null,
  updated_at integer not null
);
create index idx_entries_status_created on entries(status, created_at desc);
create index idx_entries_category on entries(category_id, status);
create index idx_entries_author on entries(author_id);

create table comments (
  id text primary key,
  entry_id text not null references entries(id) on delete cascade,
  author_id text not null references users(id),
  body text not null,
  is_anonymous integer not null default 0,
  created_at integer not null
);
create index idx_comments_entry on comments(entry_id, created_at);

create table reports (
  id text primary key,
  entry_id text not null references entries(id) on delete cascade,
  reporter_id text not null references users(id),
  reason text not null,
  created_at integer not null,
  resolved_at integer
);
create index idx_reports_entry on reports(entry_id);

create table moderation_log (
  id text primary key,
  entry_id text not null references entries(id) on delete cascade,
  actor_id text not null references users(id),
  from_status text not null,
  to_status text not null,
  reason text,
  created_at integer not null
);
create index idx_modlog_entry on moderation_log(entry_id, created_at);

create table events (
  id text primary key,
  organizer_id text references users(id),
  title text not null,
  description text not null,
  location text not null,
  registration_url text,
  starts_at integer not null,
  created_at integer not null
);
create index idx_events_starts on events(starts_at);

create table rsvps (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  user_id text not null references users(id),
  created_at integer not null,
  unique (event_id, user_id)
);
create index idx_rsvps_event on rsvps(event_id);

create table event_reminders (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  user_id text not null references users(id),
  send_at integer not null,
  sent_at integer,
  unique (event_id, user_id)
);

create table attachments (
  id text primary key,
  entry_id text not null references entries(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  byte_size integer not null,
  storage_path text not null,
  created_at integer not null
);
create index idx_attachments_entry on attachments(entry_id);

create table outbox (
  id text primary key,
  kind text not null,
  to_role text,
  to_user_id text,
  subject text not null,
  body text not null,
  created_at integer not null,
  read_at integer
);
create index idx_outbox_created on outbox(created_at desc);

create table rate_limits (
  key text primary key,
  window_start integer not null,
  count integer not null
);
