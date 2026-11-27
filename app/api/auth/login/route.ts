import { NextResponse } from "next/server";
import { authenticate, MIN_PASSWORD_LENGTH } from "@/lib/auth/provider";
import { verifyPassword } from "@/lib/auth/password";
import {
  checkLoginLock,
  clearLoginLock,
  createLoginLockStore,
  formatLoginLockMessage,
  loginLockKey,
  recordLoginFailure,
  remainingAttempts,
  type LoginLockState,
} from "@/lib/auth/login-lock";
import { sqlite } from "@/lib/db/client";
import { ensureUser, getStoredUser } from "@/lib/db/users";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSessionToken,
  type Role,
} from "@/lib/auth/token";

export const runtime = "nodejs";

const loginLocks = createLoginLockStore(sqlite);

function safeNext(value: unknown): string {
  const raw = typeof value === "string" ? value : "/";
  if (!raw.startsWith("/")) return "/";

  // Browsers treat backslashes as slashes in URLs, so `/\evil.com` is an
  // open redirect even though it does not literally start with `//`.
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return "/";
  }
  if (decoded.startsWith("//") || decoded.includes("\\")) return "/";
  return raw;
}

function loginError(
  request: Request,
  next: string,
  message: string,
  state?: LoginLockState,
): NextResponse {
  const target = new URL("/login", request.url);
  target.searchParams.set("error", message);
  target.searchParams.set("next", next);
  if (state) {
    target.searchParams.set("remaining", String(remainingAttempts(state)));
    if (state.locked) {
      target.searchParams.set("retryAfter", String(Math.ceil(state.retryAfterMs / 1000)));
    }
  }
  return NextResponse.redirect(target, { status: 303 });
}

/** Blank or short values are sign-in failures too, so they consume an attempt. */
function invalidSubmission(username: string, password: string): string | null {
  const hasUsername = username.trim().length > 0;
  const hasPassword = password.length > 0;

  if (!hasUsername && !hasPassword) {
    return "Enter your email or student number and password.";
  }
  if (!hasUsername) return "Enter your email or student number.";
  if (!hasPassword) return "Enter your password.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));

  // Check the lock first: a locked identifier is rejected even if the new
  // submission is blank or otherwise invalid.
  const lockKey = loginLockKey(username);
  const lock = await checkLoginLock(loginLocks, lockKey);
  if (lock.locked) {
    return loginError(request, next, formatLoginLockMessage(lock.retryAfterMs), lock);
  }

  const invalid = invalidSubmission(username, password);
  if (invalid) {
    const failure = await recordLoginFailure(loginLocks, lockKey);
    return loginError(request, next, invalid, failure);
  }

  const key = username.trim().toLowerCase();
  // The single USC administrator is the only built-in demo identity.
  // Students are database-backed rows with scrypt password hashes.
  let user = authenticate(username, password);

  if (!user) {
    const row = await sqlite
      .prepare(
        `select id, username, role, display_name, password_hash
         from users
         where (lower(email) = ? or lower(username) = ?) and password_hash is not null`,
      )
      .get(key, key) as
      | {
          id: string;
          username: string;
          role: string;
          display_name: string;
          password_hash: string;
        }
      | undefined;

    if (row && verifyPassword(password, row.password_hash)) {
      const role: Role = row.role === "admin" ? "admin" : "student";
      user = {
        id: row.id,
        username: row.username,
        role,
        displayName: row.display_name,
      };
    }
  }

  if (!user) {
    const failure = await recordLoginFailure(loginLocks, lockKey);
    return loginError(
      request,
      next,
      "That email, username, or password was not recognized.",
      failure,
    );
  }

  await clearLoginLock(loginLocks, lockKey);
  await ensureUser(user);
  // Keep the nickname the account chose in settings instead of resetting it to
  // the seeded default on every login.
  const stored = await getStoredUser(user.id);
  const resolved = stored ? { ...user, displayName: stored.display_name } : user;
  const token = await signSessionToken(resolved);

  const destination = new URL(next, request.url);
  const response = NextResponse.redirect(destination, { status: 303 });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
