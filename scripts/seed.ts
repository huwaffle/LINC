import { sqlite, closeDatabase } from "../lib/db/client";
import { runMigrations } from "../lib/db/migrate";
import { seed } from "../lib/db/seed";
import { topUpPosts } from "../lib/db/top-up-posts";

await runMigrations(sqlite);

const existing = await sqlite.prepare("select count(*) as n from entries").get() as { n: number };
if (existing.n > 0) {
  console.error("Database already contains entries. Use `npm run db:reset` to rebuild it.");
  process.exit(1);
}

await seed(sqlite);
await topUpPosts(sqlite);
console.log("Seeded demo data.");
await closeDatabase();
