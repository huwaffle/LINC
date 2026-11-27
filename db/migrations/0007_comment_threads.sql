-- Comment replies and likes. A reply points at another comment; likes are a
-- separate join table so they never inflate post like counts.

alter table comments add column parent_id text references comments(id);
create index comments_parent_idx on comments(parent_id);

create table comment_likes (
  id text primary key,
  comment_id text not null references comments(id) on delete cascade,
  user_id text not null references users(id),
  created_at integer not null
);
create unique index comment_likes_comment_user_uq on comment_likes(comment_id, user_id);
create index comment_likes_comment_idx on comment_likes(comment_id);
create index comment_likes_user_idx on comment_likes(user_id, created_at desc);
