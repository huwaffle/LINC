-- Every post gets a tracking code. Anonymous posts keep the hashed receipt
-- (entry_receipts) so the code can never be tied to an account; attributed
-- posts store theirs here so the author can see it again.

alter table entries add column tracking_code text;
create unique index entries_tracking_code_uq on entries(tracking_code) where tracking_code is not null;
