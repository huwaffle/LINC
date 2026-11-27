-- Implicit interest signal for the personalised feed: how often a user opened a post or event.
create table if not exists interest_views (
  user_id text not null,
  kind text not null check (kind in ('entry', 'event')),
  item_id text not null,
  views integer not null default 1,
  last_viewed_at integer not null,
  primary key (user_id, kind, item_id)
);
create index if not exists interest_views_user_idx on interest_views (user_id, last_viewed_at);
