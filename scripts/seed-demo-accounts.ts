/**
 * Backfills the documented demo accounts into an existing database without
 * touching posts, events, or other seeded content. `db:reset` already calls the
 * same idempotent helper; this script is for databases created by older builds
 * that had no administrator or no student password hashes.
 */
import {
  DEMO_ACCOUNT_PASSWORD,
  DEMO_ADMIN,
  DEMO_STUDENTS,
  studentUsername,
} from "../lib/auth/demo-accounts";

async function main() {
  const { sqlite } = await import("../lib/db/client");

  const usersTable = await sqlite
    .prepare("select 1 from information_schema.tables where table_schema = 'public' and table_name = 'users'")
    .get();
  if (!usersTable) {
    throw new Error("The users table is missing. Run `npm run db:migrate` first.");
  }

  const { seedDemoAccounts } = await import("../lib/db/seed");
  await seedDemoAccounts(sqlite);

  const first = studentUsername(DEMO_STUDENTS[0]);
  const last = studentUsername(DEMO_STUDENTS[DEMO_STUDENTS.length - 1]);
  console.log(
    `demo accounts ready: ${DEMO_ADMIN.username}/${DEMO_ACCOUNT_PASSWORD} (${DEMO_ADMIN.email}), students ${first}-${last}/${DEMO_ACCOUNT_PASSWORD}`,
  );
}

await main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { closeDatabase } = await import("../lib/db/client");
    await closeDatabase();
  });

export {};
