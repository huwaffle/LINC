import { sqlite, closeDatabase } from "../lib/db/client";
import { runMigrations } from "../lib/db/migrate";
import { seed } from "../lib/db/seed";
import { topUpPosts } from "../lib/db/top-up-posts";

const APP_TABLES = [
  "safety_checks",
  "safety_scans",
  "safety_flags",
  "safety_terms",
  "interest_views",
  "ads",
  "rate_limits",
  "outbox",
  "event_reminders",
  "rsvps",
  "events",
  "comment_likes",
  "reposts",
  "saves",
  "likes",
  "entry_receipts",
  "moderation_log",
  "reports",
  "entry_topics",
  "attachments",
  "comments",
  "entries",
  "users",
  "categories",
];

async function main() {
  const ran = await runMigrations(sqlite);
  console.log(`applied ${ran.length} migration(s)`);

  await sqlite.exec(`truncate table ${APP_TABLES.join(", ")} restart identity cascade`);
  console.log("cleared application tables");

  await seed(sqlite);
  await topUpPosts(sqlite);

  const counts = await sqlite
    .prepare(
      `select
         (select count(*) from categories) as categories,
         (select count(*) from users) as users,
         (select count(*) from entries) as entries,
         (select count(*) from entries where status = 'published') as published,
         (select count(*) from entries where status = 'pending') as pending,
         (select count(*) from attachments) as attachments,
         (select count(*) from events) as events,
         (select count(*) from rsvps) as rsvps`,
    )
    .get();
  console.log("seeded:", counts);
}

await main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
