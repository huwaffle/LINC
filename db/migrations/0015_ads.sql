create table ads (
  id text primary key,
  title text not null,
  body text not null default '',
  sponsor text not null,
  link_url text not null,
  image_path text,
  image_mime text,
  active integer not null default 1,
  created_at integer not null
);
