import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "linc_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

/** Only the USC administrator and students exist. */
export type Role = "admin" | "student";

export type SessionUser = {
  id: string;
  username: string;
  role: Role;
  displayName: string;
};

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "local-dev-secret-please-change-32chars",
);

export async function signSessionToken(user: SessionUser): Promise<string> {
  return await new SignJWT({
    username: user.username,
    role: user.role,
    displayName: user.displayName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      username: String(payload.username ?? ""),
      role: payload.role === "admin" ? "admin" : "student",
      displayName: String(payload.displayName ?? "User"),
    };
  } catch {
    return null;
  }
}
