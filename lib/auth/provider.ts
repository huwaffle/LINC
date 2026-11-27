import {
  DEMO_ACCOUNT_PASSWORD,
  DEMO_ADMIN,
  MIN_PASSWORD_LENGTH,
} from "./demo-accounts";
import type { SessionUser } from "./token";

export { DEMO_ACCOUNT_PASSWORD, DEMO_ADMIN, MIN_PASSWORD_LENGTH };

/**
 * Demo authenticator (AUTH_MODE=demo).
 *
 * Only the built-in USC administrator is handled here. Students are real
 * database rows with scrypt password hashes, verified by the login route.
 * There are no council accounts and no arbitrary-credential fallback.
 */
export const ADMIN_IDENTITY: SessionUser = {
  id: DEMO_ADMIN.id,
  username: DEMO_ADMIN.username,
  role: "admin",
  displayName: DEMO_ADMIN.displayName,
};

export function authenticate(
  rawUsername: string,
  password: string,
  mode = process.env.AUTH_MODE ?? "demo",
): SessionUser | null {
  if (mode !== "demo") return null;

  const username = rawUsername.trim().toLowerCase();
  if (!username) return null;
  if (password.length < MIN_PASSWORD_LENGTH) return null;

  if (username === DEMO_ADMIN.username || username === DEMO_ADMIN.email) {
    return password === DEMO_ACCOUNT_PASSWORD ? ADMIN_IDENTITY : null;
  }

  // Students are database-backed. The demo provider never invents an identity.
  return null;
}
