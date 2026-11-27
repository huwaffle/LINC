import { sqlite } from "../lib/db/client";
import { runMigrations } from "../lib/db/migrate";
import { sweepReminders } from "../lib/reminders";

/**
 * Local reminder sweep. Replaces pg_cron: every 60 seconds it turns due
 * event reminders into rows in the local outbox, which the admin console
 * renders as an inbox. No SMTP server required.
 */

await runMigrations(sqlite);

console.log("LINC reminder worker started (60s interval). Ctrl+C to stop.");
console.log(`initial sweep: ${await sweepReminders()} reminder(s) queued`);

const timer = setInterval(async () => {
  const count = await sweepReminders();
  if (count > 0) {
    console.log(`[${new Date().toISOString()}] queued ${count} reminder(s)`);
  }
}, 60_000);

process.on("SIGINT", () => {
  clearInterval(timer);
  console.log("\nworker stopped");
  process.exit(0);
});
