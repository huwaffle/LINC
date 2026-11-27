-- Anonymous submission receipts and student notification links

-- A receipt is the only link between an anonymous submitter and their entry.
-- Only a keyed hash of the code is stored, so a database copy cannot be used
-- to recover a receipt code.
create table entry_receipts (
  entry_id text primary key references entries(id) on delete cascade,
  code_hash text not null unique,
  created_at integer not null
);

-- Lets the notification inbox deep-link to the entry or page that caused it.
alter table outbox add column href text;
