import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const ALLOWED_EMAIL_DOMAIN = "@dlsau.edu.ph";

export function isSchoolEmail(email: string): boolean {
  return /^[a-z0-9._%+-]+@dlsau\.edu\.ph$/i.test(email.trim());
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export const RECOVERY_COOKIE = "linc_recovery";

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 16 characters from an unambiguous alphabet, shown as XXXX-XXXX-XXXX-XXXX. */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(16);
  const chars = Array.from(bytes, (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return hashPassword(normalizeRecoveryCode(code));
}

export function verifyRecoveryCode(code: string, stored: string): boolean {
  return verifyPassword(normalizeRecoveryCode(code), stored);
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}
