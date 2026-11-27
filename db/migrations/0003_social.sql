-- Likes and saved threads

create table likes (
  id text primary key,
  entry_id text not null references entries(id) on delete cascade,
  user_id text not null references users(id),
  created_at integer not null
);
create unique index likes_entry_user_uq on likes(entry_id, user_id);
create index likes_entry_idx on likes(entry_id);
create index likes_user_idx on likes(user_id, created_at desc);

create table saves (
  id text primary key,
  entry_id text not null references entries(id) on delete cascade,
  user_id text not null references users(id),
  created_at integer not null
);
create unique index saves_entry_user_uq on saves(entry_id, user_id);
create index saves_entry_idx on saves(entry_id);
create index saves_user_idx on saves(user_id, created_at desc);
