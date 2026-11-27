-- Administrator-managed offensive-word filters. These are added to the Gemini
-- prompt and matched by the offline scanner in addition to the built-in
-- English/Filipino lexicon. The unique expression index keeps terms
-- case-insensitive while preserving the administrator's original spelling.
create table if not exists safety_terms (
  id text primary key,
  term text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  category text not null default 'admin filter',
  created_by text,
  created_at integer not null
);

create unique index if not exists safety_terms_term_uq on safety_terms (lower(term));
