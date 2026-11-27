import { sqlite } from "./db/client";
import { createReceiptCode } from "./receipt-code";

/** Returns the tracking code of an attributed post, creating one the first time it is needed. */
export async function ensureTrackingCode(entryId: string): Promise<string | null> {
  const row = await sqlite
    .prepare("select tracking_code, is_anonymous from entries where id = ?")
    .get(entryId) as { tracking_code: string | null; is_anonymous: number } | undefined;
  if (!row || row.is_anonymous) return null;
  if (row.tracking_code) return row.tracking_code;

  const update = sqlite.prepare(
    "update entries set tracking_code = ? where id = ? and tracking_code is null",
  );
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createReceiptCode();
    try {
      await update.run(code, entryId);
      return (
        (await sqlite.prepare("select tracking_code from entries where id = ?").get(entryId) as {
          tracking_code: string;
        }).tracking_code
      );
    } catch {
      // Unique collision: draw another code.
    }
  }
  return null;
}

/** Tells an author that their post is in the queue and how to track it. */
export async function notifySubmission(entryId: string, userId: string, title: string, code: string): Promise<void> {
  await sqlite
    .prepare(
      `insert into outbox (id, kind, to_role, to_user_id, subject, body, href, created_at, read_at)
       values (?, 'status', null, ?, ?, ?, '/track', ?, null)`,
    )
    .run(
      `outbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      "Your post was received",
      `"${title}" is waiting for review. Tracking code: ${code}`,
      Date.now(),
    );
}

/** Notifies the author of an attributed post about a status change; anonymous posts are skipped. */
export async function notifyStatus(entryId: string, subject: string, detail: string): Promise<void> {
  const row = await sqlite
    .prepare("select author_id, title, is_anonymous from entries where id = ?")
    .get(entryId) as { author_id: string; title: string; is_anonymous: number } | undefined;
  if (!row || row.is_anonymous) return;

  const code = await ensureTrackingCode(entryId);
  await sqlite
    .prepare(
      `insert into outbox (id, kind, to_role, to_user_id, subject, body, href, created_at, read_at)
       values (?, 'status', null, ?, ?, ?, '/track', ?, null)`,
    )
    .run(
      `outbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      row.author_id,
      subject,
      `"${row.title}" ${detail}${code ? ` Tracking code: ${code}` : ""}`,
      Date.now(),
    );
}
