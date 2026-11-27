-- Custom profile pictures for signed-in accounts. The username stays fixed;
-- only the nickname and these avatar columns are user-editable.

alter table users add column avatar_path text;
alter table users add column avatar_mime text;
