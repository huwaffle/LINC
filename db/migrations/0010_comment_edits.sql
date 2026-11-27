-- Comment editing: remember when a comment was last changed by its author.

alter table comments add column edited_at integer;
