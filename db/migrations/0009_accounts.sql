alter table users add column email text;
alter table users add column password_hash text;
create unique index idx_users_email on users(email) where email is not null;
