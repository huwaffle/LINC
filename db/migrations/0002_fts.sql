-- Full-text search over published entries (SQLite FTS5, external content)

create virtual table entries_fts using fts5(
  title,
  body,
  content = 'entries',
  content_rowid = 'rowid',
  tokenize = 'porter unicode61'
);

create trigger entries_ai after insert on entries begin
  insert into entries_fts (rowid, title, body) values (new.rowid, new.title, new.body);
end;

create trigger entries_ad after delete on entries begin
  insert into entries_fts (entries_fts, rowid, title, body)
  values ('delete', old.rowid, old.title, old.body);
end;

create trigger entries_au after update on entries begin
  insert into entries_fts (entries_fts, rowid, title, body)
  values ('delete', old.rowid, old.title, old.body);
  insert into entries_fts (rowid, title, body) values (new.rowid, new.title, new.body);
end;
