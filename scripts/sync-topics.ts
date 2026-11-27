import { runMigrations } from "../lib/db/migrate";
import { sqlite, closeDatabase } from "../lib/db/client";
import { syncEmergingTopics } from "../lib/topic-sync";

await runMigrations(sqlite);
const created = await syncEmergingTopics();
console.log(created.length ? `New categories: ${created.join(", ")}` : "No new topics.");
await closeDatabase();
