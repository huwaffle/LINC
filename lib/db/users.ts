import { randomUUID } from "node:crypto";
import { sqlite } from "./client";
import type { SessionUser } from "../auth/token";

export type StoredUser = {
  id: string;
  username: string;
  role: string;
  display_name: string;
  avatar_path: string | null;
  avatar_mime: string | null;
  is_anonymous: number;
};

/** Reads the persisted identity so a customized nickname survives re-login. */
export async function getStoredUser(id: string): Promise<StoredUser | undefined> {
  return await sqlite
    .prepare(
      `select id, username, role, display_name, avatar_path, avatar_mime, is_anonymous
       from users where id = ?`,
    )
    .get(id) as StoredUser | undefined;
}

/** Nicknames are shown publicly, so they must be unique (case-insensitive). */
export async function displayNameTaken(displayName: string, exceptId?: string): Promise<boolean> {
  return Boolean(
    await sqlite
      .prepare(
        "select 1 from users where lower(display_name) = lower(?) and is_anonymous = 0 and id != ?",
      )
      .get(displayName, exceptId ?? ""),
  );
}

/** Creates the user row on first login so foreign keys stay valid. */
export async function ensureUser(user: SessionUser): Promise<void> {
  await sqlite
    .prepare(
      `insert into users (id, username, role, display_name, is_anonymous, created_at)
       values (?, ?, ?, ?, 0, ?)
       on conflict (id) do nothing`,
    )
    .run(user.id, user.username, user.role, user.displayName, Date.now());
}

/**
 * Anonymous submissions are attributed to a freshly generated pseudonymous
 * author row. The resulting entry cannot be joined back to the real student,
 * which is what the privacy requirement asks for.
 */
export async function createAnonymousAuthor(): Promise<string> {
  const suffix = randomUUID();
  const id = `user-anon-${suffix}`;
  await sqlite
    .prepare(
      `insert into users (id, username, role, display_name, is_anonymous, created_at)
       values (?, ?, 'student', 'Anonymous Lasallian', 1, ?)`,
    )
    .run(id, `anon-${suffix}`, Date.now());
  return id;
}

export function newId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
