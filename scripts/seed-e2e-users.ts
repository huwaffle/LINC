import fs from "node:fs";
import path from "node:path";
import {
  DEMO_ACCOUNT_PASSWORD,
  DEMO_STUDENTS,
  studentDisplayName,
  studentEmail,
  studentUsername,
} from "../lib/auth/demo-accounts";

/**
 * Gives the end-to-end suite accounts with a known password, so it never
 * depends on demo-auth shortcuts. Run it after `reset-db` (the verification
 * script does) or against a dev database with `npm run db:seed-e2e`.
 * All accounts are students; the USC administrator is a demo account.
 */
type Account = { email: string; username: string; displayName?: string };
type Accounts = {
  students: Record<string, Required<Account>>;
};

async function main() {
  const accounts = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "tests/e2e-accounts.json"), "utf8"),
  ) as Accounts;

  const { sqlite } = await import("../lib/db/client");
  const { hashPassword } = await import("../lib/auth/password");
  const now = Date.now();
  const passwordHash = hashPassword(DEMO_ACCOUNT_PASSWORD);

  const insert = sqlite.prepare(
    `insert into users (id, username, role, display_name, is_anonymous, created_at,
                        email, password_hash, terms_accepted_at)
     values (?, ?, 'student', ?, 0, ?, ?, ?, ?)
     on conflict (id) do update set email = excluded.email, password_hash = excluded.password_hash`,
  );
  for (const student of Object.values(accounts.students)) {
    await insert.run(
      `user-${student.username}`,
      student.username,
      student.displayName,
      now,
      student.email,
      passwordHash,
      now,
    );
  }

  // The masterlist student who owns seeded reactions, saves, and reposts.
  const activityStudent = DEMO_STUDENTS[0];
  const claim = sqlite.prepare(
    "update users set email = ?, password_hash = ?, terms_accepted_at = ? where username = ?",
  );
  const claimed = await claim.run(
    studentEmail(activityStudent),
    passwordHash,
    now,
    studentUsername(activityStudent),
  );
  if (claimed.changes === 0) {
    throw new Error(
      `Seeded student ${studentUsername(activityStudent)} does not exist; reset the database first.`,
    );
  }

  // The suite creates posts and signs in repeatedly. Clear only test identities'
  // limit/lock rows so reruns against a dev database stay deterministic.
  await sqlite.prepare(
    `delete from rate_limits
     where key like '%:user-e2e-%'
        or key like 'login:e2e%'
        or key = ?`,
  ).run(`login:${studentUsername(activityStudent)}`);

  console.log(
    `seeded ${Object.keys(accounts.students).length} e2e student(s) and claimed ${studentDisplayName(activityStudent)} (${studentUsername(activityStudent)})`,
  );
}

await main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { closeDatabase } = await import("../lib/db/client");
    await closeDatabase();
  });
