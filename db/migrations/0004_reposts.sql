-- Reposts

create table reposts (
  id text primary key,
  entry_id text not null references entries(id) on delete cascade,
  user_id text not null references users(id),
  created_at integer not null
);
create unique index reposts_entry_user_uq on reposts(entry_id, user_id);
create index reposts_entry_idx on reposts(entry_id);
create index reposts_user_idx on reposts(user_id, created_at desc);
