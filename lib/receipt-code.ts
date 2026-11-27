import { createHmac, randomInt } from "node:crypto";

/**
 * Receipt codes use an unambiguous alphabet: no I, O, 0, or 1. That keeps a
 * code readable when someone writes it down or reads it over the phone.
 */
export const RECEIPT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const RECEIPT_LENGTH = 12;

/**
 * The signing key means a copied database alone cannot be used to check guesses
 * against the stored hashes. This app is local-first, so a fixed development
 * fallback is acceptable; deployments can set RECEIPT_SECRET.
 */
const RECEIPT_SECRET = process.env.RECEIPT_SECRET ?? "linc-local-receipt-secret";

/** Creates a human-friendly code such as `K7QF-3M2P-9XRT`. */
export function createReceiptCode(): string {
  let raw = "";
  for (let i = 0; i < RECEIPT_LENGTH; i += 1) {
    raw += RECEIPT_ALPHABET[randomInt(RECEIPT_ALPHABET.length)];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

/**
 * Accepts codes with spaces, hyphens, or lowercase letters. Returns the bare
 * 12-character form, or null when the input is not a valid receipt code.
 */
export function normalizeReceiptCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s-]/g, "");
  if (compact.length !== RECEIPT_LENGTH) return null;
  for (const character of compact) {
    if (!RECEIPT_ALPHABET.includes(character)) return null;
  }
  return compact;
}

/** Keyed hash stored in the database. The plaintext code is never persisted. */
export function hashReceiptCode(code: string): string {
  const normalized = normalizeReceiptCode(code);
  if (!normalized) throw new Error("Cannot hash an invalid receipt code");
  return createHmac("sha256", RECEIPT_SECRET).update(`receipt:${normalized}`).digest("hex");
}

/** Formats a normalized or raw code for display. */
export function formatReceiptCode(code: string): string {
  const normalized = normalizeReceiptCode(code);
  if (!normalized) return code;
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}`;
}
