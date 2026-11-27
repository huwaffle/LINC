import { sqlite, closeDatabase } from "../lib/db/client";
import { runMigrations } from "../lib/db/migrate";

const ran = await runMigrations(sqlite);
if (ran.length === 0) {
  console.log("No pending migrations.");
} else {
  console.log(`Applied ${ran.length} migration(s): ${ran.join(", ")}`);
}
await closeDatabase();
