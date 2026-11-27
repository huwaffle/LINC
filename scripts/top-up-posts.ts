import { sqlite, closeDatabase } from "../lib/db/client";
import { runMigrations } from "../lib/db/migrate";
import { topUpPosts } from "../lib/db/top-up-posts";

await runMigrations(sqlite);
const added = await topUpPosts(sqlite, Number(process.argv[2]) || 10);
console.log(`Added ${added} demo post(s).`);
await closeDatabase();
