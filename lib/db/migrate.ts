import fs from "node:fs";
import path from "node:path";
import { isMigrated, type SqliteDatabase } from "./client";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const BASE_MIGRATION = "0001_init.sql";

/**
 * Applies the Supabase PostgreSQL migrations in order.
 *
 * `0001_init.sql` is the consolidated base schema. Databases created with the
 * original council-aware version are detected with `isMigrated()` and are not
 * rerun; `0002_remove_councils.sql` then upgrades them in place. Applied files
 * are recorded in `schema_migrations` so later runs are no-ops.
 */
export async function runMigrations(db: SqliteDatabase): Promise<string[]> {
  await db.exec(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at bigint not null
    )
  `);

  const applied = await db
    .prepare<{ filename: string }>("select filename from schema_migrations")
    .all();
  const appliedSet = new Set(applied.map((row) => row.filename));
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    throw new Error(`No Supabase migrations found in ${MIGRATIONS_DIR}`);
  }

  const ran: string[] = [];
  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const fullPath = path.join(MIGRATIONS_DIR, file);

    if (file === BASE_MIGRATION && (await isMigrated())) {
      await db
        .prepare("insert into schema_migrations (filename, applied_at) values (?, ?)")
        .run(file, Date.now());
      continue;
    }

    await db.exec(fs.readFileSync(fullPath, "utf8"));
    await db
      .prepare("insert into schema_migrations (filename, applied_at) values (?, ?)")
      .run(file, Date.now());
    ran.push(file);
  }
  return ran;
}
