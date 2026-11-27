# Legacy SQLite migrations — obsolete

These files are the original SQLite/Drizzle migration history. They are kept only as a reference for the schema decisions that were consolidated into:

- `supabase/migrations/0001_init.sql` — canonical PostgreSQL schema
- `supabase/seed.sql` — reference categories and demo data

Do **not** apply these files to Supabase. They use SQLite syntax (`insert or ignore`, FTS5, `sqlite_master`, and `strftime`) and will fail on PostgreSQL.

The application no longer reads this directory. `npm run db:migrate`, `npm run db:reset`, and `supabase db push` use `supabase/migrations/` instead.
