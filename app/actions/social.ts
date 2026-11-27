"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/authz";
import { sqlite } from "@/lib/db/client";
import { resolveMentions } from "@/lib/db/queries";
import { splitMentions } from "@/lib/mentions";
import { notifyStatus } from "@/lib/tracking";
import { excerpt } from "@/lib/format";
import { ensureUser, newId } from "@/lib/db/users";
import { hitLimit } from "@/lib/rate-limit";
import { done, fail } from "@/lib/redirects";
import { scheduleContentScan } from "@/lib/moderation/safety";
import { commentSchema, eventSchema, firstError, reportSchema } from "@/lib/validation";

export async function addComment(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Sign in to join the discussion.");

  const parsed = commentSchema.safeParse({
    entryId: formData.get("entryId"),
    parentId:
      typeof formData.get("parentId") === "string" && String(formData.get("parentId")).trim()
        ? String(formData.get("parentId")).trim()
        : undefined,
    body: formData.get("body"),
    isAnonymous: formData.get("isAnonymous") === "on" && session.role !== "admin",
  });

  if (!parsed.success) {
    const entryId = String(formData.get("entryId") ?? "");
    fail(`/c/${String(formData.get("slug") ?? "")}/${entryId}`, firstError(parsed.error));
  }

  if (!await hitLimit(`comment:${session.id}`, 10, 10 * 60_000)) {
    fail(`/c/${String(formData.get("slug") ?? "")}/${parsed.data.entryId}`, "Too many comments. Please slow down.");
  }

  if (parsed.data.parentId) {
    const parent = await sqlite
      .prepare("select entry_id from comments where id = ?")
      .get(parsed.data.parentId) as { entry_id: string } | undefined;
    if (!parent || parent.entry_id !== parsed.data.entryId) {
      fail(
        `/c/${String(formData.get("slug") ?? "")}/${parsed.data.entryId}`,
        "That comment is no longer available to reply to.",
      );
    }
  }

  await ensureUser(session);
  const authorId = parsed.data.isAnonymous ? await ensureAnonymousCommenter(session.id) : session.id;

  const commentId = newId("comment");
  await sqlite
    .prepare(
      `insert into comments (id, entry_id, author_id, parent_id, body, is_anonymous, created_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      commentId,
      parsed.data.entryId,
      authorId,
      parsed.data.parentId ?? null,
      parsed.data.body,
      parsed.data.isAnonymous ? 1 : 0,
      Date.now(),
    );

  await notifyMentions({
    body: parsed.data.body,
    previousBody: "",
    actorId: session.id,
    actorName: parsed.data.isAnonymous ? null : session.displayName,
    href: `/c/${String(formData.get("slug") ?? "")}/${parsed.data.entryId}#comment-${commentId}`,
  });
  scheduleContentScan("comment", commentId);

  revalidatePath(`/c/${String(formData.get("slug") ?? "")}/${parsed.data.entryId}`);
  done(
    `/c/${String(formData.get("slug") ?? "")}/${parsed.data.entryId}`,
    parsed.data.parentId ? "Reply posted." : "Comment posted.",
  );
}

/** Sends a personal notification to everyone newly @mentioned in a comment. */
async function notifyMentions(options: {
  body: string;
  previousBody: string;
  actorId: string;
  actorName: string | null;
  href: string;
}): Promise<void> {
  const before = new Set(
    [...(await resolveMentions([options.previousBody])).values()].map((user) => user.id),
  );
  const resolved = await resolveMentions([options.body]);
  const mentioned = new Map<string, string>();
  for (const part of splitMentions(options.body, resolved)) {
    if (part.type !== "mention") continue;
    const user = resolved.get(part.text.slice(1).toLowerCase());
    if (user && user.id !== options.actorId && !before.has(user.id)) mentioned.set(user.id, user.id);
  }

  const insert = sqlite.prepare(
    `insert into outbox (id, kind, to_role, to_user_id, subject, body, href, created_at, read_at)
     values (?, 'mention', null, ?, ?, ?, ?, ?, null)`,
  );
  const now = Date.now();
  for (const userId of mentioned.keys()) {
    await insert.run(
      newId("outbox"),
      userId,
      `${options.actorName ?? "Someone"} mentioned you in a comment`,
      excerpt(options.body, 160),
      options.href,
      now,
    );
  }
}

export async function editComment(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Sign in to edit your comment.");

  const commentId = String(formData.get("commentId") ?? "");
  const comment = await sqlite
    .prepare(
      `select cm.id, cm.entry_id, cm.author_id, cm.body, cm.is_anonymous, c.slug
       from comments cm
       join entries e on e.id = cm.entry_id
       join categories c on c.id = e.category_id
       where cm.id = ?`,
    )
    .get(commentId) as
    | { id: string; entry_id: string; author_id: string; body: string; is_anonymous: number; slug: string }
    | undefined;

  if (!comment) fail("/", "That comment could not be found.");
  const back = `/c/${comment.slug}/${comment.entry_id}`;
  if (comment.author_id !== session.id) fail(back, "You can only edit your own comments.");

  const parsed = commentSchema.shape.body.safeParse(formData.get("body"));
  if (!parsed.success) fail(back, firstError(parsed.error));

  if (!await hitLimit(`comment-edit:${session.id}`, 20, 10 * 60_000)) {
    fail(back, "Too many edits. Please slow down.");
  }

  if (parsed.data !== comment.body) {
    await sqlite
      .prepare("update comments set body = ?, edited_at = ? where id = ?")
      .run(parsed.data, Date.now(), comment.id);
    await notifyMentions({
      body: parsed.data,
      previousBody: comment.body,
      actorId: session.id,
      actorName: comment.is_anonymous ? null : session.displayName,
      href: `${back}#comment-${comment.id}`,
    });
    scheduleContentScan("comment", comment.id);
  }

  revalidatePath(back);
  revalidatePath("/me");
  done(back, "Comment updated.");
}

/** Comments reuse one pseudonymous row per submission to avoid identity linkage. */
async function ensureAnonymousCommenter(realUserId: string): Promise<string> {
  const suffix = newId("anon");
  await sqlite
    .prepare(
      `insert into users (id, username, role, display_name, is_anonymous, created_at)
       values (?, ?, 'student', 'Anonymous Lasallian', 1, ?)`,
    )
    .run(suffix, `anon-${suffix}`, Date.now());
  return suffix;
}

export async function reportEntry(
  _prev: { ok: boolean } | null,
  formData: FormData,
): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) fail("/login", "Sign in to report an entry.");

  const parsed = reportSchema.safeParse({
    entryId: formData.get("entryId"),
    reason: formData.get("reason"),
  });

  const slug = String(formData.get("slug") ?? "");
  if (!parsed.success) fail(`/c/${slug}/${String(formData.get("entryId") ?? "")}`, firstError(parsed.error));

  if (!can(session).report()) fail("/", "You are not allowed to report entries.");

  if (!await hitLimit(`report:${session.id}`, 5, 60 * 60_000)) {
    fail(`/c/${slug}/${parsed.data.entryId}`, "You have reported too many entries. Please contact the USC directly.");
  }

  await ensureUser(session);
  const now = Date.now();
  const reported = await sqlite.prepare("select title from entries where id = ?").get(parsed.data.entryId) as
    | { title: string }
    | undefined;

  await sqlite.transaction(async () => {
    await sqlite
      .prepare(
        "insert into reports (id, entry_id, reporter_id, reason, created_at, resolved_at) values (?, ?, ?, ?, ?, null)",
      )
      .run(newId("report"), parsed.data.entryId, session.id, parsed.data.reason, now);

    // Returning a published entry to the queue is the moderation response.
    await sqlite
      .prepare("update entries set status = 'pending', updated_at = ? where id = ? and status = 'published'")
      .run(now, parsed.data.entryId);

    await sqlite
      .prepare(
        `insert into outbox (id, kind, to_role, subject, body, href, created_at, read_at)
         values (?, 'report', 'admin', ?, ?, ?, ?, null)`,
      )
      .run(
        newId("outbox"),
        `Post reported: ${reported?.title ?? "an entry"}`,
        `${session.displayName} reported this post. Reason: ${parsed.data.reason}`,
        `/admin/posts`,
        now,
      );
  });

  await notifyStatus(
    parsed.data.entryId,
    "Your post is being reviewed again",
    "was reported and returned to the moderation queue.",
  );

  return { ok: true };
}

/**
 * Called when the report confirmation closes. Revalidating inside reportEntry
 * would re-render the page and unmount the confirmation before it is seen.
 */
export async function refreshAfterReport(): Promise<void> {
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function toggleLike(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Sign in to like posts.");

  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return;

  const entry = await sqlite
    .prepare(
      `select c.slug, u.username from entries e
       join categories c on c.id = e.category_id
       join users u on u.id = e.author_id
       where e.id = ?`,
    )
    .get(entryId) as { slug: string; username: string } | undefined;
  if (!entry) return;

  await ensureUser(session);
  const existing = await sqlite
    .prepare("select id from likes where entry_id = ? and user_id = ?")
    .get(entryId, session.id) as { id: string } | undefined;

  if (existing) {
    await sqlite.prepare("delete from likes where id = ?").run(existing.id);
  } else {
    await sqlite
      .prepare("insert into likes (id, entry_id, user_id, created_at) values (?, ?, ?, ?)")
      .run(newId("like"), entryId, session.id, Date.now());
  }

  revalidatePost(entryId, entry.slug, entry.username);
}

export async function toggleCommentLike(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Sign in to like comments.");

  const commentId = String(formData.get("commentId") ?? "");
  if (!commentId) return;

  const comment = await sqlite
    .prepare(
      `select cm.entry_id, c.slug from comments cm
       join entries e on e.id = cm.entry_id
       join categories c on c.id = e.category_id
       where cm.id = ?`,
    )
    .get(commentId) as { entry_id: string; slug: string } | undefined;
  if (!comment) return;

  await ensureUser(session);
  const existing = await sqlite
    .prepare("select id from comment_likes where comment_id = ? and user_id = ?")
    .get(commentId, session.id) as { id: string } | undefined;

  if (existing) {
    await sqlite.prepare("delete from comment_likes where id = ?").run(existing.id);
  } else {
    await sqlite
      .prepare("insert into comment_likes (id, comment_id, user_id, created_at) values (?, ?, ?, ?)")
      .run(newId("comment-like"), commentId, session.id, Date.now());
  }

  revalidatePath(`/c/${comment.slug}/${comment.entry_id}`);
  const notice = existing ? "Comment like removed." : "Comment liked.";
  redirect(
    `/c/${comment.slug}/${comment.entry_id}?notice=${encodeURIComponent(notice)}#comment-${commentId}`,
  );
}

export async function toggleSave(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Sign in to save posts.");

  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return;

  const entry = await sqlite
    .prepare(
      `select c.slug, u.username from entries e
       join categories c on c.id = e.category_id
       join users u on u.id = e.author_id
       where e.id = ?`,
    )
    .get(entryId) as { slug: string; username: string } | undefined;
  if (!entry) return;

  await ensureUser(session);
  const existing = await sqlite
    .prepare("select id from saves where entry_id = ? and user_id = ?")
    .get(entryId, session.id) as { id: string } | undefined;

  if (existing) {
    await sqlite.prepare("delete from saves where id = ?").run(existing.id);
  } else {
    await sqlite
      .prepare("insert into saves (id, entry_id, user_id, created_at) values (?, ?, ?, ?)")
      .run(newId("save"), entryId, session.id, Date.now());
  }

  revalidatePost(entryId, entry.slug, entry.username);
}

export async function toggleRepost(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Sign in to repost posts.");

  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return;

  const entry = await sqlite
    .prepare(
      `select c.slug, u.username from entries e
       join categories c on c.id = e.category_id
       join users u on u.id = e.author_id
       where e.id = ?`,
    )
    .get(entryId) as { slug: string; username: string } | undefined;
  if (!entry) return;

  await ensureUser(session);
  const existing = await sqlite
    .prepare("select id from reposts where entry_id = ? and user_id = ?")
    .get(entryId, session.id) as { id: string } | undefined;

  if (existing) {
    await sqlite.prepare("delete from reposts where id = ?").run(existing.id);
  } else {
    await sqlite
      .prepare("insert into reposts (id, entry_id, user_id, created_at) values (?, ?, ?, ?)")
      .run(newId("repost"), entryId, session.id, Date.now());
  }

  revalidatePost(entryId, entry.slug, entry.username);
  revalidatePath(`/u/${session.username}`);
}

function revalidatePost(entryId: string, categorySlug: string, authorUsername: string): void {
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/me");
  revalidatePath("/saved");
  revalidatePath(`/c/${categorySlug}`);
  revalidatePath(`/c/${categorySlug}/${entryId}`);
  revalidatePath(`/u/${authorUsername}`);
}

export async function createEvent(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Sign in first.");
  if (session.role !== "admin") {
    fail("/events", "Only the USC administrator can publish events.");
  }

  const formPath = "/admin/events/new";

  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    location: formData.get("location"),
    registrationUrl: formData.get("registrationUrl") ?? "",
    startsAt: formData.get("startsAt"),
  });

  if (!parsed.success) fail(formPath, firstError(parsed.error));

  if (!can(session).publishEvent()) {
    fail(formPath, "Only the USC administrator can publish events.");
  }

  const startsAt = new Date(parsed.data.startsAt).getTime();
  if (Number.isNaN(startsAt)) fail(formPath, "That date could not be read.");

  await sqlite
    .prepare(
      `insert into events (id, organizer_id, title, description, location, registration_url, starts_at, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      newId("event"),
      session.id,
      parsed.data.title,
      parsed.data.description,
      parsed.data.location,
      parsed.data.registrationUrl ?? null,
      startsAt,
      Date.now(),
    );

  revalidatePath("/events");
  done("/events", "Event published.");
}

export async function toggleRsvp(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login?next=/events", "Sign in to mark yourself as going.");

  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) fail("/events", "That event no longer exists.");

  const requested = String(formData.get("returnTo") ?? "");
  const returnTo =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/events";

  await ensureUser(session);
  const existing = await sqlite
    .prepare("select id from rsvps where event_id = ? and user_id = ?")
    .get(eventId, session.id) as { id: string } | undefined;

  if (existing) {
    await sqlite.transaction(async () => {
      await sqlite.prepare("delete from rsvps where id = ?").run(existing.id);
      await sqlite
        .prepare("delete from event_reminders where event_id = ? and user_id = ?")
        .run(eventId, session.id);
    });
    revalidatePath("/events");
    revalidatePath(returnTo);
    done(returnTo, "You are no longer marked as going.");
  }

  const now = Date.now();
  await sqlite.transaction(async () => {
    await sqlite
      .prepare("insert into rsvps (id, event_id, user_id, created_at) values (?, ?, ?, ?) on conflict do nothing")
      .run(newId("rsvp"), eventId, session.id, now);

    const event = await sqlite
      .prepare("select starts_at from events where id = ?")
      .get(eventId) as { starts_at: number } | undefined;

    if (event) {
      await sqlite
        .prepare(
          "insert into event_reminders (id, event_id, user_id, send_at, sent_at) values (?, ?, ?, ?, null) on conflict do nothing",
        )
        .run(newId("rem"), eventId, session.id, event.starts_at - 86400_000);
    }
  });

  revalidatePath("/events");
  revalidatePath(returnTo);
  done(returnTo, "Marked as going. A reminder will appear in the local outbox.");
}
