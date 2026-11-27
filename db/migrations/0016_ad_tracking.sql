alter table ads add column impressions integer not null default 0;
alter table ads add column clicks integer not null default 0;
alter table ads add column starts_at integer;
alter table ads add column ends_at integer;
