"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/authz";
import { sqlite } from "@/lib/db/client";
import { createAnonymousAuthor, ensureUser, newId } from "@/lib/db/users";
import { decideCategory, decisionNote } from "@/lib/ml/category";
import { ensureTrackingCode, notifySubmission } from "@/lib/tracking";
import { hitLimit } from "@/lib/rate-limit";
import { createReceipt, rememberReceipt } from "@/lib/receipts";
import { scheduleContentScan } from "@/lib/moderation/safety";
import { done, fail } from "@/lib/redirects";
import { entrySchema, firstError } from "@/lib/validation";
import { uploadFile } from "@/lib/storage";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/pdf",
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

export async function submitEntry(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Please sign in before submitting an entry.");

  if (!can(session).submitEntry()) fail("/submit", "You are not allowed to submit entries.");

  if (!await hitLimit(`submit:${session.id}`, 5, 10 * 60_000)) {
    fail("/submit", "You are submitting too quickly. Please wait a few minutes.");
  }

  const parsed = entrySchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    categoryId: formData.get("categoryId"),
    isAnonymous: formData.get("isAnonymous") === "on" && session.role !== "admin",
  });

  if (!parsed.success) fail("/submit", firstError(parsed.error));
  const input = parsed.data;

  const decision = await decideCategory(`${input.title}. ${input.body}`, input.categoryId || null);
  if (!decision) fail("/submit", "That category does not exist.");
  const categoryNote = decisionNote(decision);

  await ensureUser(session);
  const authorId = input.isAnonymous ? await createAnonymousAuthor() : session.id;
  const id = newId("entry");
  const now = Date.now();

  await sqlite
    .prepare(
      `insert into entries (id, author_id, category_id, title, body, status,
                            is_anonymous, reject_reason, created_at, updated_at)
       values (?, ?, ?, ?, ?, 'pending', ?, null, ?, ?)`,
    )
    .run(
      id,
      authorId,
      decision.categoryId,
      input.title,
      input.body,
      input.isAnonymous ? 1 : 0,
      now,
      now,
    );

  await sqlite
    .prepare(
      `insert into moderation_log (id, entry_id, actor_id, from_status, to_status, reason, created_at)
       values (?, ?, ?, 'draft', 'pending', ?, ?)`,
    )
    .run(newId("mod"), id, authorId, categoryNote, now);

  // Optional attachment
  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      await cleanupEntry(id);
      fail("/submit", "Attachment must be 25 MB or smaller.");
    }
    if (!ALLOWED_MIME.has(file.type)) {
      await cleanupEntry(id);
      fail("/submit", "Attachment must be a PNG, JPEG, WebP, GIF, MP4, WebM, or PDF.");
    }

    const storagePath = `${newId("file")}.${EXTENSION_BY_MIME[file.type]}`;
    await uploadFile("attachments", storagePath, new Uint8Array(await file.arrayBuffer()), file.type);

    await sqlite
      .prepare(
        `insert into attachments (id, entry_id, filename, mime_type, byte_size, storage_path, created_at)
         values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId("att"), id, file.name, file.type, file.size, storagePath, now);
  }

  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath("/admin");

  scheduleContentScan("entry", id);

  if (input.isAnonymous) {
    // The receipt is the only way back to an anonymous entry, so show it once
    // and keep a copy on this device for the /track page.
    const code = await createReceipt(id);
    await rememberReceipt(code);
    done(
      "/receipt",
      `Your anonymous entry was submitted and is awaiting administrator review.${categoryNote ? ` ${categoryNote}` : ""}`,
    );
  }
  const trackingCode = await ensureTrackingCode(id);
  if (trackingCode) await notifySubmission(id, session.id, input.title, trackingCode);
  done(
    "/me",
    `Your entry was submitted and is now in the moderation queue. Tracking code: ${trackingCode}.${categoryNote ? ` ${categoryNote}` : ""}`,
  );
}

async function cleanupEntry(entryId: string): Promise<void> {
  await sqlite.prepare("delete from moderation_log where entry_id = ?").run(entryId);
  await sqlite.prepare("delete from entries where id = ?").run(entryId);
}
