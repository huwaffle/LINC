import { formatLockCountdown } from "./login-countdown";
import { sqlite, type DatabaseClient } from "../db/client";

/** Five failed sign-ins lock the identifier for three minutes. */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MS = 3 * 60 * 1000;

const SELECT_SQL = "select count, window_start from rate_limits where key = ?";
const UPSERT_SQL = `insert into rate_limits (key, window_start, count) values (?, ?, ?)
  on conflict (key) do update set window_start = excluded.window_start, count = excluded.count`;
const DELETE_SQL = "delete from rate_limits where key = ?";

export type LoginLockRecord = {
  attempts: number;
  windowStart: number;
};

export type LoginLockState = {
  attempts: number;
  locked: boolean;
  retryAfterMs: number;
};

type Mutation<T> = {
  value: T;
  next: LoginLockRecord | null;
};

type RateLimitRow = { count: number; window_start: number };

function toRecord(row: RateLimitRow | undefined): LoginLockRecord | undefined {
  if (!row) return undefined;
  return { attempts: Number(row.count), windowStart: Number(row.window_start) };
}

/**
 * Minimal storage surface so the lockout rules can be unit-tested without a
 * database. The Postgres-backed implementation uses a transaction so two
 * simultaneous failures cannot race past the five-attempt threshold.
 */
export interface LoginLockStore {
  mutate<T>(key: string, fn: (current: LoginLockRecord | undefined) => Mutation<T>): Promise<T>;
}

export function createLoginLockStore(db: DatabaseClient = sqlite): LoginLockStore {
  return {
    async mutate(key, fn) {
      // Prepare inside the transaction so every read/write uses the same
      // connection; statements bound to the pool would run outside it.
      return await db.transaction(async (tx) => {
        const txSelect = tx.prepare<RateLimitRow>(SELECT_SQL);
        const txUpsert = tx.prepare(UPSERT_SQL);
        const txRemove = tx.prepare(DELETE_SQL);

        const current = toRecord(await txSelect.get(key));
        const { value, next } = fn(current);
        if (next) await txUpsert.run(key, next.windowStart, next.attempts);
        else await txRemove.run(key);
        return value;
      });
    },
  };
}

export function loginLockKey(identifier: string): string {
  return `login:${identifier.trim().toLowerCase()}`;
}

function resolve(record: LoginLockRecord | undefined, now: number): LoginLockState {
  if (!record) return { attempts: 0, locked: false, retryAfterMs: 0 };

  // A window that has elapsed is discarded, giving the user a fresh set of
  // attempts. Reaching the threshold restarts the window below, so the lock
  // always lasts the full three minutes from the fifth failure.
  if (now - record.windowStart >= LOGIN_LOCK_MS) {
    return { attempts: 0, locked: false, retryAfterMs: 0 };
  }

  const locked = record.attempts >= LOGIN_MAX_FAILURES;
  return {
    attempts: record.attempts,
    locked,
    retryAfterMs: locked ? Math.max(1, LOGIN_LOCK_MS - (now - record.windowStart)) : 0,
  };
}

export async function checkLoginLock(
  store: LoginLockStore,
  key: string,
  now = Date.now(),
): Promise<LoginLockState> {
  return await store.mutate(key, (current) => {
    const state = resolve(current, now);
    return {
      value: state,
      // Drop an expired row; otherwise keep it untouched.
      next: current && now - current.windowStart >= LOGIN_LOCK_MS ? null : current ?? null,
    };
  });
}

export async function recordLoginFailure(
  store: LoginLockStore,
  key: string,
  now = Date.now(),
): Promise<LoginLockState> {
  return await store.mutate(key, (current) => {
    const state = resolve(current, now);
    if (state.locked) return { value: state, next: current ?? null };

    const attempts = state.attempts + 1;
    const next: LoginLockRecord = {
      attempts,
      windowStart:
        attempts >= LOGIN_MAX_FAILURES ? now : state.attempts === 0 ? now : current!.windowStart,
    };
    return { value: resolve(next, now), next };
  });
}

export async function clearLoginLock(store: LoginLockStore, key: string): Promise<void> {
  await store.mutate(key, () => ({ value: undefined, next: null }));
}

export function remainingAttempts(state: LoginLockState): number {
  return Math.max(0, LOGIN_MAX_FAILURES - state.attempts);
}

export function formatLoginLockMessage(retryAfterMs: number): string {
  return `Too many unsuccessful sign-in attempts. Try again in ${formatLockCountdown(retryAfterMs)}.`;
}
