import { sqlite, closeDatabase } from "../lib/db/client";
import { runMigrations } from "../lib/db/migrate";
import { seedDemoAds } from "../lib/db/ads";

await runMigrations(sqlite);
console.log(`Added ${await seedDemoAds()} demo ad(s).`);
await closeDatabase();
