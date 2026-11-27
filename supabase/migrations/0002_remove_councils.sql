-- Remove the council layer from databases created with the original
-- 0001_init.sql. Every statement is idempotent, so this file is also safe on a
-- fresh database created from the current (council-free) 0001_init.sql.

-- Policies that reference `council_id` must go before the columns are dropped.
drop policy if exists "council reads scoped entries" on entries;
drop policy if exists "council moderates entries" on entries;
drop policy if exists "user reads own profile" on users;
drop policy if exists "admin reads reports" on reports;
drop policy if exists "admin reads moderation log" on moderation_log;
drop policy if exists "admin manages attachments" on storage.objects;

do $$
begin
  if to_regclass('public.councils') is not null then
    drop policy if exists "public reads councils" on public.councils;
  end if;
end $$;

-- Any existing council users become ordinary students. The app's db:reset
-- truncates and reseeds all accounts immediately after this migration.
update users set role = 'student' where role = 'council';

alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('admin', 'student'));

alter table users drop column if exists council_id;
alter table entries drop column if exists council_id;
alter table events add column if not exists organizer_id text references users(id);
alter table events drop column if exists council_id;
drop table if exists councils;

-- Recreate the moderation/profile/auth policies with admin-only scoping.
drop policy if exists "admin reads all entries" on entries;
create policy "admin reads all entries" on entries for select to authenticated
  using (auth.jwt() ->> 'role' = 'admin');

drop policy if exists "admin moderates entries" on entries;
create policy "admin moderates entries" on entries for update to authenticated
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

drop policy if exists "user reads own profile" on users;
create policy "user reads own profile" on users for select to authenticated
  using (id = auth.jwt() ->> 'sub' or auth.jwt() ->> 'role' = 'admin');

drop policy if exists "admin reads reports" on reports;
create policy "admin reads reports" on reports for select to authenticated
  using (auth.jwt() ->> 'role' = 'admin');

drop policy if exists "admin reads moderation log" on moderation_log;
create policy "admin reads moderation log" on moderation_log for select to authenticated
  using (auth.jwt() ->> 'role' = 'admin');

drop policy if exists "admin manages attachments" on storage.objects;
create policy "admin manages attachments" on storage.objects for all to authenticated
  using (bucket_id = 'attachments' and auth.jwt() ->> 'role' = 'admin');
