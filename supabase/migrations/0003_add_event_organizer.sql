-- Databases that already applied 0002_remove_councils.sql still need the
-- replacement column used by the admin-only event form. Safe to rerun.
alter table events add column if not exists organizer_id text references users(id);
