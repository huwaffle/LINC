-- Posts tagged with an automatically created topic category (in addition to their own category).
create table if not exists entry_topics (
  entry_id text not null,
  category_id text not null,
  primary key (entry_id, category_id)
);
create index if not exists entry_topics_category_idx on entry_topics (category_id);
