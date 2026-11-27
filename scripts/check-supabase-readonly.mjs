import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const REQUIRED_TABLES = [
  "categories",
  "users",
  "entries",
  "comments",
  "attachments",
  "entry_topics",
  "reports",
  "moderation_log",
  "entry_receipts",
  "likes",
  "saves",
  "reposts",
  "comment_likes",
  "events",
  "rsvps",
  "event_reminders",
  "outbox",
  "rate_limits",
  "ads",
  "safety_terms",
  "safety_scans",
  "safety_checks",
  "safety_flags",
  "interest_views",
];

const ALLOWED_ROLES = ["admin", "student"];

const shortError = (error) => error?.code ?? error?.status ?? error?.name ?? "unknown";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.log("DB: DATABASE_URL missing");
} else {
  const sql = postgres(dbUrl, {
    max: 1,
    prepare: false,
    ssl: "require",
    connect_timeout: 10,
  });

  try {
    await sql`select 1`;
    console.log("DB: connected");

    const tableRows = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
    `;
    const names = new Set(tableRows.map((row) => String(row.table_name)));
    const missing = REQUIRED_TABLES.filter((table) => !names.has(table));

    console.log(`DB: public tables found = ${names.size}`);
    console.log(
      missing.length === 0
        ? "DB: all required tables present"
        : `DB: MISSING TABLES = ${missing.join(", ")}`,
    );

    const extraTables = [...names].filter((table) => !REQUIRED_TABLES.includes(table));
    console.log(
      extraTables.length === 0
        ? "DB: no unexpected public tables"
        : `DB: additional public tables = ${extraTables.join(", ")}`,
    );

    // Any retired organization table appears above; this confirms no retired
    // role value survived in the account data. A clean database simply passes.
    try {
      const roleRows = await sql`select distinct role from users where role is not null`;
      const unexpectedRoles = roleRows
        .map((row) => String(row.role))
        .filter((role) => !ALLOWED_ROLES.includes(role));
      console.log(
        unexpectedRoles.length === 0
          ? "DB: user roles are limited to admin and student"
          : `DB: UNEXPECTED ROLES = ${unexpectedRoles.join(", ")}`,
      );
    } catch (error) {
      console.log(`DB: role check skipped (${shortError(error)})`);
    }

    const searchColumn = await sql`
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'entries'
        and column_name = 'search_tsv'
      limit 1
    `;
    const searchIndex = await sql`
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'entries'
        and indexname = 'entries_search_idx'
      limit 1
    `;
    console.log(
      searchColumn.length > 0
        ? "DB: entries.search_tsv present"
        : "DB: entries.search_tsv MISSING",
    );
    console.log(
      searchIndex.length > 0
        ? "DB: entries_search_idx present"
        : "DB: entries_search_idx MISSING",
    );

    try {
      const counts = await sql`
        select
          (select count(*) from categories)::int as categories,
          (select count(*) from users)::int as users,
          (select count(*) from entries)::int as entries,
          (select count(*) from attachments)::int as attachments
      `;
      console.log(`DB: row counts = ${JSON.stringify(counts[0])}`);
    } catch (error) {
      console.log(`DB: counts skipped (${shortError(error)})`);
    }
  } catch (error) {
    const code = shortError(error);
    const message = String(error?.message ?? "");
    if (message.includes("ECIRCUITBREAKER")) {
      console.log(
        "DB: FAILED (ECIRCUITBREAKER — too many failed logins; wait a few minutes before retrying)",
      );
    } else if (code === "ENOTFOUND") {
      console.log(
        "DB: FAILED (ENOTFOUND — use Supabase Connect → Session pooler on port 5432 or Transaction pooler on 6543)",
      );
    } else {
      console.log(`DB: FAILED (${code})`);
    }
  } finally {
    await sql.end({ timeout: 2 });
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.log("STORAGE: skipped — SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY missing");
} else if (serviceKey.startsWith("sb_publishable_")) {
  console.log("STORAGE: skipped — service key is a publishable key, not a service-role key");
} else {
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.log(`STORAGE: FAILED (${shortError(error)})`);
  } else {
    const buckets = (data ?? []).map(
      (bucket) => `${bucket.name}=${bucket.public ? "public" : "private"}`,
    );
    console.log(
      buckets.length === 0
        ? "STORAGE: no buckets found"
        : `STORAGE: buckets = ${buckets.join(", ")}`,
    );
  }
}
