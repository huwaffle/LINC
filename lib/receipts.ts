import { cookies } from "next/headers";
import { sqlite } from "./db/client";
import type { EntryStatus } from "./db/schema";
import { createReceiptCode, formatReceiptCode, hashReceiptCode, normalizeReceiptCode } from "./receipt-code";

/** Shown once on /receipt so the submitter can save their code. */
export const RECEIPT_COOKIE = "linc_receipt";
/** Kept on this device so /track can look the receipt up without a login. */
export const TRACK_COOKIE = "linc_track";

const RECEIPT_TTL_SECONDS = 60 * 60 * 24 * 30;
const TRACK_TTL_SECONDS = 60 * 60 * 24 * 30;

export type ReceiptStatus = {
  entry_id: string;
  title: string;
  status: EntryStatus;
  reject_reason: string | null;
  category_slug: string;
  category_label: string;
  created_at: number;
  updated_at: number;
};

/**
 * Issues a receipt for an anonymous entry. Only the keyed hash is stored, so
 * the code cannot be recovered from the database later.
 */
export async function createReceipt(entryId: string): Promise<string> {
  const code = createReceiptCode();
  await sqlite
    .prepare(
      `insert into entry_receipts (entry_id, code_hash, created_at)
       values (?, ?, ?)`,
    )
    .run(entryId, hashReceiptCode(code), Date.now());
  return code;
}

/** Remembers the receipt after submission so /receipt can reveal it once. */
export async function rememberReceipt(code: string): Promise<void> {
  const store = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false, // localhost only
    path: "/",
    maxAge: RECEIPT_TTL_SECONDS,
  };
  store.set(RECEIPT_COOKIE, code, options);
  store.set(TRACK_COOKIE, code, { ...options, maxAge: TRACK_TTL_SECONDS });
}

export async function clearReceiptNotice(): Promise<void> {
  const store = await cookies();
  store.delete(RECEIPT_COOKIE);
}

export async function rememberTracking(code: string): Promise<void> {
  const store = await cookies();
  store.set(TRACK_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: TRACK_TTL_SECONDS,
  });
}

export async function clearTracking(): Promise<void> {
  const store = await cookies();
  store.delete(TRACK_COOKIE);
}

export async function readReceiptNotice(): Promise<string | null> {
  const store = await cookies();
  const code = store.get(RECEIPT_COOKIE)?.value;
  return code && normalizeReceiptCode(code) ? code : null;
}

export async function readTrackedCode(): Promise<string | null> {
  const store = await cookies();
  const code = store.get(TRACK_COOKIE)?.value;
  return code && normalizeReceiptCode(code) ? code : null;
}

/**
 * Looks up a post by tracking code: the hashed receipt for anonymous posts, or
 * the stored code for attributed ones. Each lookup is filtered by anonymity, so
 * a receipt can never expose an attributed entry or the reverse.
 */
export async function findReceipt(code: string): Promise<ReceiptStatus | undefined> {
  const normalized = normalizeReceiptCode(code);
  if (!normalized) return undefined;

  const select = `select e.id as entry_id, e.title, e.status, e.reject_reason,
              c.slug as category_slug, c.label as category_label,
              e.created_at, e.updated_at`;
  const joins = `join categories c on c.id = e.category_id`;

  const anonymous = await sqlite
    .prepare(
      `${select}
       from entry_receipts r join entries e on e.id = r.entry_id ${joins}
       where r.code_hash = ? and e.is_anonymous = 1`,
    )
    .get(hashReceiptCode(normalized)) as ReceiptStatus | undefined;
  if (anonymous) return anonymous;

  return await sqlite
    .prepare(`${select} from entries e ${joins} where e.tracking_code = ? and e.is_anonymous = 0`)
    .get(formatReceiptCode(normalized)) as ReceiptStatus | undefined;
}
