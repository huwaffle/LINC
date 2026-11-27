-- LINC — Supabase PostgreSQL schema
-- Two roles only: USC administrator (`admin`) and students (`student`).
-- No council role, council table, or council scoping exists in this schema.
-- Consolidated from the legacy SQLite migrations in db/migrations/.
-- Timestamps stay as epoch milliseconds (bigint) so existing application
-- comparisons and cursor pagination keep working without a semantic rewrite.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table categories (
  id text primary key,
  slug text not null unique,
  label text not null,
  description text not null,
  sort_order integer not null default 0
);

create table users (
  id text primary key,
  username text not null unique,
  role text not null check (role in ('admin', 'student')),
  display_name text not null,
  email text,
  password_hash text,
  avatar_path text,
  avatar_mime text,
  is_anonymous integer not null default 0 check (is_anonymous in (0, 1)),
  recovery_code_hash text,
  terms_accepted_at bigint,
  created_at bigint not null
);

create unique index users_email_uq on users (email) where email is not null;

-- ---------------------------------------------------------------------------
-- Content
-- ---------------------------------------------------------------------------

create table entries (
  id text primary key,
  author_id text not null references users(id),
  category_id text not null references categories(id),
  title text not null,
  body text not null,
  status text not null check (status in ('draft', 'pending', 'published', 'rejected', 'redacted')),
  is_anonymous integer not null default 0 check (is_anonymous in (0, 1)),
  reject_reason text,
  tracking_code text,
  created_at bigint not null,
  updated_at bigint not null,
  search_tsv tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) stored
);

create unique index entries_tracking_code_uq on entries (tracking_code) where tracking_code is not null;
create index entries_status_created_idx on entries (status, created_at desc);
create index entries_category_idx on entries (category_id, status);
create index entries_author_idx on entries (author_id);
create index entries_search_idx on entries using gin (search_tsv);

create table comments (
  id text primary key,
  entry_id text not null references entries(id) on delete cascade,
  author_id text not null references users(id),
  parent_id text references comments(id),
  body text not null,
  is_anonymous integer not null default 0 check (is_anonymous in (0, 1)),
  created_at bigint not null,
  edited_at bigint
);
create index comments_entry_idx on comments (entry_id, created_at);
create index comments_parent_idx on comments (parent_id);

create table attachments (
  id text primary key,
  entry_id text not null references entries(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  byte_size bigint not null,
  storage_path text not null,
  created_at bigint not null
);
create index attachments_entry_idx on attachments (entry_id);

create table entry_topics (
  entry_id text not null references entries(id) on delete cascade,
  category_id text not null references categories(id) on delete cascade,
  primary key (entry_id, category_id)
);
create index entry_topics_category_idx on entry_topics (category_id);

-- ---------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------

create table reports (
  id text primary key,
  entry_id text not null references entries(id) on delete cascade,
  reporter_id text not null references users(id),
  reason text not null,
  created_at bigint not null,
  resolved_at bigint
);
create index reports_entry_idx on reports (entry_id);

create table moderation_log (
  id text primary key,
  entry_id text not null references entries(id) on delete cascade,
  actor_id text not null references users(id),
  from_status text not null,
  to_status text not null,
  reason text,
  created_at bigint not null
);
create index modlog_entry_idx on moderation_log (entry_id, created_at);

create table entry_receipts (
  entry_id text primary key references entries(id) on delete cascade,
  code_hash text not null unique,
  created_at bigint not null
);

-- ---------------------------------------------------------------------------
-- Social
-- ---------------------------------------------------------------------------

create table likes (
  id text primary key,
  entry_id text not null references entries(id) on delete cascade,
  user_id text not null references users(id),
  created_at bigint not null,
  unique (entry_id, user_id)
);
create index likes_entry_idx on likes (entry_id);
create index likes_user_idx on likes (user_id, created_at desc);

create table saves (
  id text primary key,
  entry_id text not null references entries(id) on delete cascade,
  user_id text not null references users(id),
  created_at bigint not null,
  unique (entry_id, user_id)
);
create index saves_entry_idx on saves (entry_id);
create index saves_user_idx on saves (user_id, created_at desc);

create table reposts (
  id text primary key,
  entry_id text not null references entries(id) on delete cascade,
  user_id text not null references users(id),
  created_at bigint not null,
  unique (entry_id, user_id)
);
create index reposts_entry_idx on reposts (entry_id);
create index reposts_user_idx on reposts (user_id, created_at desc);

create table comment_likes (
  id text primary key,
  comment_id text not null references comments(id) on delete cascade,
  user_id text not null references users(id),
  created_at bigint not null,
  unique (comment_id, user_id)
);
create index comment_likes_comment_idx on comment_likes (comment_id);
create index comment_likes_user_idx on comment_likes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table events (
  id text primary key,
  organizer_id text references users(id),
  title text not null,
  description text not null,
  location text not null,
  registration_url text,
  starts_at bigint not null,
  created_at bigint not null
);
create index events_starts_idx on events (starts_at);

create table rsvps (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  user_id text not null references users(id),
  created_at bigint not null,
  unique (event_id, user_id)
);
create index rsvps_event_idx on rsvps (event_id);

create table event_reminders (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  user_id text not null references users(id),
  send_at bigint not null,
  sent_at bigint,
  unique (event_id, user_id)
);
create index event_reminders_due_idx on event_reminders (sent_at, send_at);

-- ---------------------------------------------------------------------------
-- Notifications, ads, recommendations
-- ---------------------------------------------------------------------------

create table outbox (
  id text primary key,
  kind text not null,
  to_role text,
  to_user_id text,
  subject text not null,
  body text not null,
  href text,
  created_at bigint not null,
  read_at bigint
);
create index outbox_created_idx on outbox (created_at desc);

create table rate_limits (
  key text primary key,
  window_start bigint not null,
  count integer not null
);

create table ads (
  id text primary key,
  title text not null,
  body text not null default '',
  sponsor text not null,
  link_url text not null,
  image_path text,
  image_mime text,
  active integer not null default 1 check (active in (0, 1)),
  impressions integer not null default 0,
  clicks integer not null default 0,
  starts_at bigint,
  ends_at bigint,
  created_at bigint not null
);

create table interest_views (
  user_id text not null references users(id) on delete cascade,
  kind text not null check (kind in ('entry', 'event')),
  item_id text not null,
  views integer not null default 1,
  last_viewed_at bigint not null,
  primary key (user_id, kind, item_id)
);
create index interest_views_user_idx on interest_views (user_id, last_viewed_at);

-- ---------------------------------------------------------------------------
-- Content safety
-- ---------------------------------------------------------------------------

create table safety_flags (
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
  reviewed_at bigint,
  created_at bigint not null,
  updated_at bigint not null,
  unique (target_type, target_id)
);
create index safety_flags_status_idx on safety_flags (status, severity, updated_at);

create table safety_scans (
  id text primary key,
  scanned_count integer not null,
  flagged_count integer not null,
  notified_count integer not null default 0,
  provider text not null,
  created_at bigint not null
);

create table safety_checks (
  target_type text not null check (target_type in ('entry', 'account', 'comment')),
  target_id text not null,
  content_hash text not null,
  provider text not null,
  severity text not null check (severity in ('none', 'low', 'medium', 'high')),
  scanned_at bigint not null,
  primary key (target_type, target_id)
);
create index safety_checks_scanned_idx on safety_checks (scanned_at);

create table safety_terms (
  id text primary key,
  term text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  category text not null default 'admin filter',
  created_by text,
  created_at bigint not null
);
create unique index safety_terms_term_uq on safety_terms (lower(term));

-- ---------------------------------------------------------------------------
-- Row Level Security
-- The Next.js app connects with the service role (bypasses RLS) and enforces
-- its own policy in lib/authz.ts. These policies let you also expose the
-- tables to clients that authenticate with Supabase and carry a `sub` claim
-- matching users.id and `role` (admin or student).
-- ---------------------------------------------------------------------------

alter table categories enable row level security;
alter table users enable row level security;
alter table entries enable row level security;
alter table comments enable row level security;
alter table attachments enable row level security;
alter table entry_topics enable row level security;
alter table reports enable row level security;
alter table moderation_log enable row level security;
alter table entry_receipts enable row level security;
alter table likes enable row level security;
alter table saves enable row level security;
alter table reposts enable row level security;
alter table comment_likes enable row level security;
alter table events enable row level security;
alter table rsvps enable row level security;
alter table event_reminders enable row level security;
alter table outbox enable row level security;
alter table rate_limits enable row level security;
alter table ads enable row level security;
alter table interest_views enable row level security;
alter table safety_flags enable row level security;
alter table safety_scans enable row level security;
alter table safety_checks enable row level security;
alter table safety_terms enable row level security;

create policy "public reads categories" on categories for select to anon, authenticated using (true);

create policy "public reads published entries" on entries for select to anon, authenticated
  using (status = 'published');
create policy "author reads own entries" on entries for select to authenticated
  using (author_id = auth.jwt() ->> 'sub');
create policy "admin reads all entries" on entries for select to authenticated
  using (auth.jwt() ->> 'role' = 'admin');
create policy "author inserts entries" on entries for insert to authenticated
  with check (author_id = auth.jwt() ->> 'sub');
create policy "author updates own draft" on entries for update to authenticated
  using (author_id = auth.jwt() ->> 'sub' and status in ('draft', 'rejected'))
  with check (author_id = auth.jwt() ->> 'sub');
create policy "admin moderates entries" on entries for update to authenticated
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

create policy "public reads comments" on comments for select to anon, authenticated
  using (exists (select 1 from entries e where e.id = entry_id and e.status = 'published'));
create policy "author manages own comments" on comments for all to authenticated
  using (author_id = auth.jwt() ->> 'sub')
  with check (author_id = auth.jwt() ->> 'sub');

create policy "public reads published media" on attachments for select to anon, authenticated
  using (exists (select 1 from entries e where e.id = entry_id and e.status = 'published'));
create policy "author reads own media" on attachments for select to authenticated
  using (exists (select 1 from entries e where e.id = entry_id and e.author_id = auth.jwt() ->> 'sub'));

create policy "public reads events" on events for select to anon, authenticated using (true);
create policy "user manages own rsvp" on rsvps for all to authenticated
  using (user_id = auth.jwt() ->> 'sub') with check (user_id = auth.jwt() ->> 'sub');
create policy "user manages own reminders" on event_reminders for all to authenticated
  using (user_id = auth.jwt() ->> 'sub') with check (user_id = auth.jwt() ->> 'sub');

create policy "user manages own reactions" on likes for all to authenticated
  using (user_id = auth.jwt() ->> 'sub') with check (user_id = auth.jwt() ->> 'sub');
create policy "user manages own saves" on saves for all to authenticated
  using (user_id = auth.jwt() ->> 'sub') with check (user_id = auth.jwt() ->> 'sub');
create policy "user manages own reposts" on reposts for all to authenticated
  using (user_id = auth.jwt() ->> 'sub') with check (user_id = auth.jwt() ->> 'sub');
create policy "user manages own comment likes" on comment_likes for all to authenticated
  using (user_id = auth.jwt() ->> 'sub') with check (user_id = auth.jwt() ->> 'sub');

create policy "user reads own profile" on users for select to authenticated
  using (id = auth.jwt() ->> 'sub' or auth.jwt() ->> 'role' = 'admin');
create policy "user updates own profile" on users for update to authenticated
  using (id = auth.jwt() ->> 'sub') with check (id = auth.jwt() ->> 'sub');

create policy "user reads own notifications" on outbox for select to authenticated
  using (to_user_id = auth.jwt() ->> 'sub' or to_role = auth.jwt() ->> 'role');
create policy "admin reads all notifications" on outbox for select to authenticated
  using (auth.jwt() ->> 'role' = 'admin');
create policy "user reads own interests" on interest_views for all to authenticated
  using (user_id = auth.jwt() ->> 'sub') with check (user_id = auth.jwt() ->> 'sub');

create policy "admin manages safety" on safety_flags for all to authenticated
  using (auth.jwt() ->> 'role' = 'admin') with check (auth.jwt() ->> 'role' = 'admin');
create policy "admin reads safety scans" on safety_scans for select to authenticated
  using (auth.jwt() ->> 'role' = 'admin');
create policy "admin reads safety checks" on safety_checks for select to authenticated
  using (auth.jwt() ->> 'role' = 'admin');
create policy "admin manages safety terms" on safety_terms for all to authenticated
  using (auth.jwt() ->> 'role' = 'admin') with check (auth.jwt() ->> 'role' = 'admin');

create policy "admin reads reports" on reports for select to authenticated
  using (auth.jwt() ->> 'role' = 'admin');
create policy "user files reports" on reports for insert to authenticated
  with check (reporter_id = auth.jwt() ->> 'sub');
create policy "admin reads moderation log" on moderation_log for select to authenticated
  using (auth.jwt() ->> 'role' = 'admin');
create policy "public reads ads" on ads for select to anon, authenticated using (active = 1);

-- ---------------------------------------------------------------------------
-- Storage buckets (attachments are private; avatars and ad images are public)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('attachments', 'attachments', false, 26214400,
   array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','application/pdf']),
  ('avatars', 'avatars', true, 5242880,
   array['image/png','image/jpeg','image/webp','image/gif']),
  ('ad-images', 'ad-images', true, 5242880,
   array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "public reads avatars" on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');
create policy "public reads ad images" on storage.objects for select to anon, authenticated
  using (bucket_id = 'ad-images');
create policy "signed-in reads attachments" on storage.objects for select to authenticated
  using (bucket_id = 'attachments');
create policy "signed-in uploads own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.jwt() ->> 'sub');
create policy "signed-in updates own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.jwt() ->> 'sub');
create policy "admin manages attachments" on storage.objects for all to authenticated
  using (bucket_id = 'attachments' and auth.jwt() ->> 'role' = 'admin');
create policy "admin manages ad images" on storage.objects for all to authenticated
  using (bucket_id = 'ad-images' and auth.jwt() ->> 'role' = 'admin');
