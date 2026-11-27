"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { sqlite } from "@/lib/db/client";
import { ensureUser, newId } from "@/lib/db/users";
import { done, fail } from "@/lib/redirects";
import { ensureTrackingCode, notifyStatus, notifySubmission } from "@/lib/tracking";
import { decideCategory, decisionNote } from "@/lib/ml/category";
import { scheduleContentScan } from "@/lib/moderation/safety";
import { entrySchema, firstError } from "@/lib/validation";
import type { EntryStatus } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth/token";
import { removeFileQuietly } from "@/lib/storage";

type OwnedEntry = {
  id: string;
  author_id: string;
  status: EntryStatus;
  is_anonymous: number;
  category_slug: string;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function ownedEntry(entryId: string): Promise<OwnedEntry | undefined> {
  return await sqlite
    .prepare(
      `select e.id, e.author_id, e.status, e.is_anonymous, c.slug as category_slug
       from entries e join categories c on c.id = e.category_id
       where e.id = ?`,
    )
    .get(entryId) as OwnedEntry | undefined;
}

function canManage(session: SessionUser, entry: OwnedEntry): boolean {
  return session.role === "admin" || entry.author_id === session.id;
}

function isAuthor(session: SessionUser, entry: OwnedEntry): boolean {
  return entry.author_id === session.id;
}

function revalidateEntry(entry: OwnedEntry): void {
  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath("/search");
  revalidatePath("/activity");
  revalidatePath("/admin");
  revalidatePath(`/c/${entry.category_slug}`);
  revalidatePath(`/c/${entry.category_slug}/${entry.id}`);
}

/** Drafts stay private to the author and never enter the moderation queue. */
export async function saveDraft(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Please sign in before writing a draft.");

  const title = text(formData, "title") || "Untitled draft";
  const body = text(formData, "body");
  const chosenCategoryId = text(formData, "categoryId");

  const decision = await decideCategory(`${title}. ${body}`, chosenCategoryId || null);
  if (!decision) {
    fail("/submit", "That category does not exist.");
  }
  const categoryId = decision.categoryId;

  await ensureUser(session);
  const now = Date.now();
  const entryId = text(formData, "entryId");

  if (entryId) {
    const existing = await ownedEntry(entryId);
    if (!existing || !isAuthor(session, existing)) {
      fail("/me", "That draft could not be found.");
    }
    if (existing.status !== "draft") {
      fail("/me", "Only drafts can be saved without review.");
    }
    await sqlite
      .prepare(
        `update entries set title = ?, body = ?, category_id = ?, updated_at = ?
         where id = ?`,
      )
      .run(title, body, categoryId, now, entryId);
    revalidateEntry(existing);
    done("/me?tab=drafts", `Draft saved.${decisionNote(decision) ? ` ${decisionNote(decision)}` : ""}`);
  }

  const id = newId("entry");
  await sqlite
    .prepare(
      `insert into entries (id, author_id, category_id, title, body, status,
                            is_anonymous, reject_reason, created_at, updated_at)
       values (?, ?, ?, ?, ?, 'draft', 0, null, ?, ?)`,
    )
    .run(id, session.id, categoryId, title, body, now, now);

  revalidatePath("/me");
  done(
    "/me?tab=drafts",
    `Draft saved. It stays private until you submit it for review.${decisionNote(decision) ? ` ${decisionNote(decision)}` : ""}`,
  );
}

/**
 * Editing a published or rejected post returns it to the queue, because the
 * USC administrator has to approve the new text. Drafts and pending posts stay in their
 * current state.
 */
export async function updateEntry(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Please sign in before editing a post.");

  const entryId = text(formData, "entryId");
  const entry = await ownedEntry(entryId);
  if (!entry) fail("/me", "That post could not be found.");
  const adminEdit = session.role === "admin" && !isAuthor(session, entry);
  if (!adminEdit && !isAuthor(session, entry)) fail("/", "You can only edit your own posts.");
  if (adminEdit && entry.status === "draft") fail("/admin/posts", "Drafts are private to their author.");
  if (!adminEdit && entry.is_anonymous) {
    fail(
      `/c/${entry.category_slug}/${entry.id}`,
      "Anonymous posts are detached from your account, so they cannot be edited.",
    );
  }

  const parsed = entrySchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    categoryId: formData.get("categoryId"),
    isAnonymous: formData.get("isAnonymous") === "on" && session.role !== "admin",
  });
  if (!parsed.success) {
    fail(`/c/${entry.category_slug}/${entry.id}/edit`, firstError(parsed.error));
  }

  const editDecision = parsed.data.categoryId
    ? { categoryId: parsed.data.categoryId }
    : await decideCategory(`${parsed.data.title}. ${parsed.data.body}`, null);
  if (!editDecision) fail(`/c/${entry.category_slug}/${entry.id}/edit`, "Choose a category.");

  const wasPublished = entry.status === "published";
  const wasRejected = entry.status === "rejected";
  const nextStatus: EntryStatus =
    adminEdit || entry.status === "draft" || entry.status === "pending" ? entry.status : "pending";
  const now = Date.now();

  await sqlite.transaction(async () => {
    await sqlite
      .prepare(
        `update entries
         set title = ?, body = ?, category_id = ?, status = ?,
             reject_reason = case when ? = 'pending' then null else reject_reason end,
             updated_at = ?
         where id = ?`,
      )
      .run(
        parsed.data.title,
        parsed.data.body,
        editDecision.categoryId,
        nextStatus,
        nextStatus,
        now,
        entry.id,
      );

    if (nextStatus === "pending" && entry.status !== "pending") {
      await sqlite
        .prepare(
          `insert into moderation_log (id, entry_id, actor_id, from_status, to_status, reason, created_at)
           values (?, ?, ?, ?, 'pending', ?, ?)`,
        )
        .run(
          newId("mod"),
          entry.id,
          session.id,
          entry.status,
          wasPublished
            ? "Author edited a published post; re-review required."
            : wasRejected
              ? "Author revised a returned post; re-review required."
              : "Author updated the post.",
          now,
        );
    }
  });

  if (adminEdit) {
    await sqlite
      .prepare(
        `insert into moderation_log (id, entry_id, actor_id, from_status, to_status, reason, created_at)
         values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId("mod"), entry.id, session.id, entry.status, entry.status, "Edited by an administrator.", now);
    await notifyStatus(entry.id, "An administrator edited your post", "was edited by an administrator.");
  }

  if (nextStatus === "pending" && entry.status !== "pending") {
    await notifyStatus(entry.id, "Your post is back in review", "was edited and is waiting for review again.");
  }

  // scanEntry decides whether drafts are eligible (off by default).
  scheduleContentScan("entry", entry.id);

  revalidateEntry(entry);

  if (adminEdit) {
    done(`/c/${entry.category_slug}/${entry.id}`, "Post updated.");
  }
  if (entry.status === "draft") {
    done("/me?tab=drafts", "Draft updated.");
  }
  if (nextStatus === "pending") {
    done("/me", "Your changes were saved and sent back to the USC administrator for review.");
  }
  done("/me", "Your changes were saved.");
}

/** A draft becomes a normal submission and enters the admin moderation queue. */
export async function submitDraft(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Please sign in first.");

  const entry = await ownedEntry(text(formData, "entryId"));
  if (!entry || !isAuthor(session, entry)) fail("/me", "That draft could not be found.");
  if (entry.status !== "draft") fail("/me", "That post has already been submitted.");

  const draft = await sqlite
    .prepare("select title, body, category_id from entries where id = ?")
    .get(entry.id) as { title: string; body: string; category_id: string };
  const decision = await decideCategory(`${draft.title}. ${draft.body}`, draft.category_id);
  const note = decision ? decisionNote(decision) : null;

  const now = Date.now();
  await sqlite.transaction(async () => {
    await sqlite
      .prepare("update entries set status = 'pending', category_id = ?, updated_at = ? where id = ?")
      .run(decision?.categoryId ?? draft.category_id, now, entry.id);
    await sqlite
      .prepare(
        `insert into moderation_log (id, entry_id, actor_id, from_status, to_status, reason, created_at)
         values (?, ?, ?, 'draft', 'pending', ?, ?)`,
      )
      .run(newId("mod"), entry.id, session.id, note, now);
  });

  const trackingCode = await ensureTrackingCode(entry.id);
  if (trackingCode) await notifySubmission(entry.id, session.id, draft.title, trackingCode);

  scheduleContentScan("entry", entry.id);

  revalidateEntry(entry);
  done(
    "/me",
    `Draft submitted and is now in the moderation queue.${trackingCode ? ` Tracking code: ${trackingCode}.` : ""}${note ? ` ${note}` : ""}`,
  );
}

async function removeUploadedFiles(entryId: string): Promise<void> {
  const files = await sqlite
    .prepare("select storage_path from attachments where entry_id = ?")
    .all(entryId) as Array<{ storage_path: string }>;
  for (const file of files) {
    await removeFileQuietly("attachments", file.storage_path);
  }
}

export async function deleteEntry(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Please sign in first.");

  const entry = await ownedEntry(text(formData, "entryId"));
  if (!entry) fail("/me", "That post could not be found.");
  if (!canManage(session, entry)) fail("/", "You can only delete your own posts.");

  await removeUploadedFiles(entry.id);

  await sqlite.transaction(async () => {
    // Every dependent row is removed explicitly so deletion works even if a
    // future migration drops one of the cascade rules.
    await sqlite
      .prepare(
        `delete from comment_likes where comment_id in
           (select id from comments where entry_id = ?)`,
      )
      .run(entry.id);
    await sqlite
      .prepare(
        `delete from safety_flags where target_type = 'comment' and target_id in
           (select id from comments where entry_id = ?)`,
      )
      .run(entry.id);
    await sqlite
      .prepare(
        `delete from safety_checks where target_type = 'comment' and target_id in
           (select id from comments where entry_id = ?)`,
      )
      .run(entry.id);
    await sqlite.prepare("delete from comments where entry_id = ?").run(entry.id);
    await sqlite.prepare("delete from likes where entry_id = ?").run(entry.id);
    await sqlite.prepare("delete from saves where entry_id = ?").run(entry.id);
    await sqlite.prepare("delete from reposts where entry_id = ?").run(entry.id);
    await sqlite.prepare("delete from reports where entry_id = ?").run(entry.id);
    await sqlite.prepare("delete from moderation_log where entry_id = ?").run(entry.id);
    await sqlite.prepare("delete from attachments where entry_id = ?").run(entry.id);
    await sqlite.prepare("delete from entry_receipts where entry_id = ?").run(entry.id);
    await sqlite
      .prepare("delete from safety_flags where target_type = 'entry' and target_id = ?")
      .run(entry.id);
    await sqlite
      .prepare("delete from safety_checks where target_type = 'entry' and target_id = ?")
      .run(entry.id);
    await sqlite.prepare("delete from entries where id = ?").run(entry.id);
  });

  revalidateEntry(entry);
  done(session.role === "admin" && entry.author_id !== session.id ? "/admin/posts" : "/me", "Post deleted.");
}

export async function deleteComment(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Please sign in first.");

  const commentId = text(formData, "commentId");
  const comment = await sqlite
    .prepare(
      `select cm.id, cm.entry_id, cm.author_id, cm.parent_id, c.slug
       from comments cm
       join entries e on e.id = cm.entry_id
       join categories c on c.id = e.category_id
       where cm.id = ?`,
    )
    .get(commentId) as
    | { id: string; entry_id: string; author_id: string; parent_id: string | null; slug: string }
    | undefined;

  if (!comment) fail("/me", "That comment could not be found.");
  if (session.role !== "admin" && comment.author_id !== session.id) {
    fail(`/c/${comment.slug}/${comment.entry_id}`, "You can only delete your own comments.");
  }

  await sqlite.transaction(async () => {
    // Replies survive their parent: orphaned children move up one level.
    await sqlite
      .prepare("update comments set parent_id = ? where parent_id = ?")
      .run(comment.parent_id, comment.id);
    await sqlite.prepare("delete from comment_likes where comment_id = ?").run(comment.id);
    await sqlite
      .prepare("delete from safety_flags where target_type = 'comment' and target_id = ?")
      .run(comment.id);
    await sqlite
      .prepare("delete from safety_checks where target_type = 'comment' and target_id = ?")
      .run(comment.id);
    await sqlite.prepare("delete from comments where id = ?").run(comment.id);
  });

  revalidatePath(`/c/${comment.slug}/${comment.entry_id}`);
  revalidatePath("/me");
  done(`/c/${comment.slug}/${comment.entry_id}`, "Comment deleted.");
}
