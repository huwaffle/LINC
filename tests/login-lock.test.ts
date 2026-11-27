import { describe, expect, it } from "vitest";
import {
  checkLoginLock,
  clearLoginLock,
  createLoginLockStore,
  formatLoginLockMessage,
  LOGIN_LOCK_MS,
  LOGIN_MAX_FAILURES,
  loginLockKey,
  recordLoginFailure,
  remainingAttempts,
  type LoginLockRecord,
  type LoginLockStore,
  type LoginLockState,
} from "../lib/auth/login-lock";

class MemoryLoginLockStore implements LoginLockStore {
  private records = new Map<string, LoginLockRecord>();

  async mutate<T>(
    key: string,
    fn: (current: LoginLockRecord | undefined) => { value: T; next: LoginLockRecord | null },
  ) {
    const result = fn(this.records.get(key));
    if (result.next) this.records.set(key, result.next);
    else this.records.delete(key);
    return result.value;
  }
}

describe("login lockout", () => {
  it("normalizes the identifier used as the lock key", () => {
    expect(loginLockKey("  USC@DLSau.edu.ph  ")).toBe("login:usc@dlsau.edu.ph");
    expect(loginLockKey("")).toBe("login:");
  });

  it("locks after five failures and starts the three-minute window on the fifth", async () => {
    const store = new MemoryLoginLockStore();
    const key = loginLockKey("student");

    for (let i = 0; i < 4; i += 1) {
      const state = await recordLoginFailure(store, key, 0);
      expect(state.locked).toBe(false);
      expect(state.attempts).toBe(i + 1);
      expect(remainingAttempts(state)).toBe(LOGIN_MAX_FAILURES - i - 1);
    }

    const locked = await recordLoginFailure(store, key, 0);
    expect(locked.locked).toBe(true);
    expect(locked.attempts).toBe(LOGIN_MAX_FAILURES);
    expect(locked.retryAfterMs).toBe(LOGIN_LOCK_MS);
    expect(remainingAttempts(locked)).toBe(0);
    expect(formatLoginLockMessage(locked.retryAfterMs)).toBe(
      "Too many unsuccessful sign-in attempts. Try again in 3:00.",
    );
  });

  it("derives the remaining-tries indicator from the failure count", () => {
    const firstFailure: LoginLockState = { attempts: 1, locked: false, retryAfterMs: 0 };
    const lastTry: LoginLockState = { attempts: 4, locked: false, retryAfterMs: 0 };
    const locked: LoginLockState = { attempts: 5, locked: true, retryAfterMs: LOGIN_LOCK_MS };

    expect(remainingAttempts(firstFailure)).toBe(4);
    expect(remainingAttempts(lastTry)).toBe(1);
    expect(remainingAttempts(locked)).toBe(0);
  });

  it("keeps rejecting attempts without extending the lock", async () => {
    const store = new MemoryLoginLockStore();
    const key = loginLockKey("student");

    for (let i = 0; i < 5; i += 1) await recordLoginFailure(store, key, 0);

    const active = await checkLoginLock(store, key, 60_000);
    expect(active.locked).toBe(true);
    expect(active.retryAfterMs).toBe(LOGIN_LOCK_MS - 60_000);

    const retried = await recordLoginFailure(store, key, 60_000);
    expect(retried.attempts).toBe(5);
    expect(retried.retryAfterMs).toBe(LOGIN_LOCK_MS - 60_000);
  });

  it("allows a fresh set of attempts after the lock expires", async () => {
    const store = new MemoryLoginLockStore();
    const key = loginLockKey("student");

    for (let i = 0; i < 5; i += 1) await recordLoginFailure(store, key, 0);

    const expired = await checkLoginLock(store, key, LOGIN_LOCK_MS);
    expect(expired.locked).toBe(false);
    expect(expired.attempts).toBe(0);

    const fresh = await recordLoginFailure(store, key, LOGIN_LOCK_MS);
    expect(fresh.locked).toBe(false);
    expect(fresh.attempts).toBe(1);
  });

  it("clears the lock on a successful sign-in", async () => {
    const store = new MemoryLoginLockStore();
    const key = loginLockKey("student");

    for (let i = 0; i < 4; i += 1) await recordLoginFailure(store, key, 0);
    await clearLoginLock(store, key);

    const state = await checkLoginLock(store, key, 0);
    expect(state.locked).toBe(false);
    expect(state.attempts).toBe(0);
  });

  it("exposes the database-backed store factory", () => {
    expect(typeof createLoginLockStore).toBe("function");
  });
});
