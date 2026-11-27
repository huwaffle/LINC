"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getSession } from "@/lib/auth/session";
import { ensureTrackingCode } from "@/lib/tracking";
import { can } from "@/lib/authz";
import { sqlite } from "@/lib/db/client";
import { getEntryScope } from "@/lib/db/queries";
import { newId } from "@/lib/db/users";
import { syncEmergingTopics } from "@/lib/topic-sync";
import { scheduleContentScan } from "@/lib/moderation/safety";
import { done, fail } from "@/lib/redirects";
import { moderationSchema } from "@/lib/validation";

const TARGET_STATUS = {
  publish: "published",
  reject: "rejected",
  redact: "redacted",
} as const;

const ALLOWED_FROM: Record<keyof typeof TARGET_STATUS, string[]> = {
  publish: ["pending", "rejected", "redacted"],
  reject: ["pending"],
  redact: ["published"],
};

export async function moderateEntry(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Please sign in first.");

  const parsed = moderationSchema.safeParse({
    entryId: formData.get("entryId"),
    action: formData.get("action"),
    reason: formData.get("reason") ?? undefined,
  });

  if (!parsed.success) fail("/admin/posts", "That moderation action is not valid.");
  const { entryId, action } = parsed.data;

  const scope = await getEntryScope(entryId);
  if (!scope) fail("/admin/posts", "That entry no longer exists.");

  if (!can(session).moderate(scope)) {
    fail("/admin/posts", "Only the USC administrator can moderate entries.");
  }

  if (!ALLOWED_FROM[action].includes(scope.status)) {
    fail("/admin/posts", `An entry with status "${scope.status}" cannot be ${action}ed.`);
  }

  if ((action === "reject" || action === "redact") && !parsed.data.reason) {
    fail("/admin/posts", `A reason is required when ${action === "reject" ? "rejecting" : "removing"} a post.`);
  }

  const toStatus = TARGET_STATUS[action];
  const now = Date.now();
  const code = await ensureTrackingCode(entryId);
  const trackingSuffix = code ? ` Tracking code: ${code}.` : "";

  await sqlite.transaction(async () => {
    await sqlite
      .prepare(
        "update entries set status = ?, reject_reason = ?, updated_at = ? where id = ?",
      )
      .run(toStatus, action === "publish" ? null : parsed.data.reason, now, entryId);

    await sqlite
      .prepare(
        `insert into moderation_log (id, entry_id, actor_id, from_status, to_status, reason, created_at)
         values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId("mod"), entryId, session.id, scope.status, toStatus, parsed.data.reason ?? null, now);

    // Redacting or rejecting an entry closes any open reports against it.
    if (action !== "publish") {
      await sqlite
        .prepare("update reports set resolved_at = ? where entry_id = ? and resolved_at is null")
        .run(now, entryId);
    }

    await sqlite
      .prepare(
        `insert into outbox (id, kind, to_role, to_user_id, subject, body, href, created_at, read_at)
         select ?, 'moderation', null, e.author_id, ?, ?,
                case when e.is_anonymous = 1 then '/track'
                     when e.status = 'published' then '/c/' || c.slug || '/' || e.id
                     else '/me' end,
                ?, null
         from entries e join categories c on c.id = e.category_id
         where e.id = ?`,
      )
      .run(
        newId("outbox"),
        action === "redact" ? "Your post was removed" : `Your entry was ${toStatus}`,
        (action === "reject"
          ? `An entry you submitted was returned by the USC administrator. Reason: ${parsed.data.reason}`
          : action === "redact"
            ? `Your post has been removed and will be deleted due to: ${parsed.data.reason}`
            : `An entry you submitted is now marked "${toStatus}".`) + trackingSuffix,
        now,
        entryId,
      );
  });

  // Topic sync is a slow Supabase round-trip; it must not hold the admin's
  // redirect. Like the safety scan, it runs after the response is sent.
  after(async () => {
    try {
      await syncEmergingTopics();
    } catch (error) {
      console.error(
        `[topics] Automatic sync after ${action} failed for ${entryId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  });
  if (action === "publish") scheduleContentScan("entry", entryId);
  revalidatePath("/", "layout");
  revalidatePath("/admin/posts");
  revalidatePath("/admin");
  revalidatePath("/me");
  done("/admin/posts", action === "redact" ? "Post removed." : `Entry ${toStatus}.`);
}
