import { excerpt } from "./format";

export type ActivityKind = "like" | "repost" | "comment" | "moderation";

export type ActivityRecord = {
  id: string;
  kind: ActivityKind;
  entry_id: string;
  entry_title: string;
  entry_status: string;
  category_slug: string;
  created_at: number;
  count: number;
  latest_actor: string | null;
  detail: string | null;
  status: string | null;
  reason: string | null;
};

export type OutgoingActivityKind =
  | "like"
  | "repost"
  | "comment"
  | "comment-like"
  | "save"
  | "post"
  | "rsvp";

/** Something the signed-in account did, such as liking or commenting. */
export type OutgoingActivityRecord = {
  id: string;
  kind: OutgoingActivityKind;
  entry_id: string | null;
  entry_title: string | null;
  entry_status: string | null;
  category_slug: string | null;
  created_at: number;
  actor: string | null;
  detail: string | null;
  href: string | null;
  is_reply?: boolean;
};

/** Shape shared with the outbox rows that become personal notifications. */
export type ActivityNotification = {
  id: string;
  kind: string;
  subject: string;
  body: string;
  href: string | null;
  created_at: number;
  read_at: number | null;
};

export type ActivityFeedKind =
  | ActivityKind
  | OutgoingActivityKind
  | "admin"
  | "event"
  | "system"
  | "report";

/** One row in the merged Activity timeline. */
export type ActivityFeedItem = {
  id: string;
  direction: "outgoing" | "incoming";
  kind: ActivityFeedKind;
  headline: string;
  detail: string | null;
  entry_title: string | null;
  href: string | null;
  created_at: number;
  unread: boolean;
  notification_id: string | null;
};

export type ActivityFilter = "all" | "updates" | "reactions" | "notices" | "you";

export const ACTIVITY_FILTERS: Array<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "updates", label: "Updates" },
  { value: "reactions", label: "Reactions" },
  { value: "notices", label: "Notices" },
  { value: "you", label: "You" },
];

export function parseActivityFilter(value: unknown): ActivityFilter {
  return ACTIVITY_FILTERS.some((f) => f.value === value) ? (value as ActivityFilter) : "all";
}

/** Which tab an item belongs to. */
export function activityGroup(item: Pick<ActivityFeedItem, "direction" | "kind">): ActivityFilter {
  if (item.direction === "outgoing") return "you";
  if (item.kind === "moderation") return "updates";
  if (item.kind === "like" || item.kind === "repost" || item.kind === "comment") return "reactions";
  return "notices";
}

export function filterActivity(items: ActivityFeedItem[], filter: ActivityFilter): ActivityFeedItem[] {
  return filter === "all" ? items : items.filter((item) => activityGroup(item) === filter);
}

/** Item and unread counts per tab, so each tab can show its own badge. */
export function activityCounts(
  items: ActivityFeedItem[],
): Record<ActivityFilter, { total: number; unread: number }> {
  const counts = Object.fromEntries(
    ACTIVITY_FILTERS.map((f) => [f.value, { total: 0, unread: 0 }]),
  ) as Record<ActivityFilter, { total: number; unread: number }>;

  for (const item of items) {
    for (const key of ["all", activityGroup(item)] as ActivityFilter[]) {
      counts[key].total += 1;
      if (item.unread) counts[key].unread += 1;
    }
  }
  return counts;
}

/** Likes and reposts on one post collapse into a single row. */
export function reactionHeadline(likes: number, reposts: number): string {
  const part = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return `${part(likes, "like", "likes")} and ${part(reposts, "repost", "reposts")} on your post`;
}

/**
 * Social actions are grouped by post before they reach the UI, so ten likes
 * on one post produce a single "10 likes" row instead of ten rows.
 */
export function activityHeadline(activity: ActivityRecord): string {
  const actor = activity.latest_actor ?? "Someone";

  if (activity.kind === "like") {
    return activity.count > 1
      ? `${activity.count} likes on your post`
      : `${actor} liked your post`;
  }

  if (activity.kind === "repost") {
    return activity.count > 1
      ? `${activity.count} reposts of your post`
      : `${actor} reposted your post`;
  }

  if (activity.kind === "comment") {
    return activity.count > 1
      ? `${activity.count} replies on your post`
      : `${actor} replied to your post`;
  }

  if (activity.status === "pending") return "Your post was submitted for review";
  if (activity.status === "published") return "Your post is now published";
  if (activity.status === "rejected") return "Your entry was rejected";
  if (activity.status === "redacted") return "Your post was removed";
  return "Your post was updated";
}

export function activityDetail(activity: ActivityRecord): string | null {
  if (activity.kind === "comment" && activity.detail) {
    return `“${excerpt(activity.detail, 160)}”`;
  }

  if (activity.kind === "moderation" && activity.reason) {
    if (activity.status === "redacted") return `This post will be deleted due to: ${activity.reason}`;
    return activity.status === "rejected"
      ? `Reason: ${activity.reason}`
      : activity.reason;
  }

  return null;
}

export function outgoingHeadline(record: OutgoingActivityRecord): string {
  switch (record.kind) {
    case "like":
      return record.actor ? `You liked ${record.actor}'s post` : "You liked a post";
    case "repost":
      return record.actor ? `You reposted ${record.actor}'s post` : "You reposted a post";
    case "comment":
      if (record.is_reply) {
        return record.actor
          ? `You replied to a comment on ${record.actor}'s post`
          : "You replied to a comment";
      }
      return record.actor ? `You commented on ${record.actor}'s post` : "You commented on a post";
    case "comment-like":
      return record.actor ? `You liked ${record.actor}'s comment` : "You liked a comment";
    case "save":
      return "You saved a post";
    case "post":
      return "You shared a post";
    case "rsvp":
      return "You are going to an event";
  }
}

export function outgoingDetail(record: OutgoingActivityRecord): string | null {
  if ((record.kind === "comment" || record.kind === "comment-like") && record.detail) {
    return `“${excerpt(record.detail, 160)}”`;
  }

  if (record.kind === "post" && record.entry_status) {
    if (record.entry_status === "pending") return "Waiting for administrator review";
    if (record.entry_status === "published") return "Published";
    if (record.entry_status === "rejected") return "Returned by the administrator";
    if (record.entry_status === "redacted") return "Removed";
  }

  return null;
}

export function safeHref(href: string | null): string | null {
  if (!href || !href.startsWith("/") || href.startsWith("//")) return null;
  return href;
}

function notificationKind(notification: ActivityNotification): ActivityFeedKind {
  if (notification.kind === "moderation" || notification.kind === "status") return "moderation";
  if (notification.kind === "mention") return "comment";
  if (notification.kind === "event-reminder") return "event";
  if (notification.kind === "report") return "report";
  if (notification.kind === "system") return "system";
  return "admin";
}

function moderationHref(record: ActivityRecord): string | null {
  return record.entry_status === "published"
    ? `/c/${record.category_slug}/${record.entry_id}`
    : null;
}

/**
 * Builds one reverse-chronological timeline from three sources: things you
 * did, reactions on your posts, and personal outbox notifications. A
 * moderation notification is folded into its matching post-status row so the
 * feed never shows the same moderation decision twice.
 */
export function buildActivityFeed({
  incoming,
  outgoing,
  notifications,
}: {
  incoming: ActivityRecord[];
  outgoing: OutgoingActivityRecord[];
  notifications: ActivityNotification[];
}): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = [];
  const claimedNotifications = new Set<string>();

  const likesByEntry = new Map<string, ActivityRecord>();
  const repostsByEntry = new Map<string, ActivityRecord>();
  for (const record of incoming) {
    if (record.kind === "like") likesByEntry.set(record.entry_id, record);
    if (record.kind === "repost") repostsByEntry.set(record.entry_id, record);
  }

  for (const record of incoming) {
    if (record.kind === "like" || record.kind === "repost") {
      const like = likesByEntry.get(record.entry_id);
      const repost = repostsByEntry.get(record.entry_id);
      if (like && repost) {
        if (record.kind === "repost") continue;
        items.push({
          id: `incoming:reactions:${record.entry_id}`,
          direction: "incoming",
          kind: "like",
          headline: reactionHeadline(like.count, repost.count),
          detail: null,
          entry_title: like.entry_title,
          href: moderationHref(like),
          created_at: Math.max(like.created_at, repost.created_at),
          unread: false,
          notification_id: null,
        });
        continue;
      }
    }

    let matched: ActivityNotification | undefined;

    if (record.kind === "moderation") {
      matched = notifications.find(
        (notification) =>
          !claimedNotifications.has(notification.id) &&
          notification.kind === "moderation" &&
          notification.created_at === record.created_at &&
          (record.reason === null || notification.body.includes(record.reason)) &&
          notification.subject.toLowerCase().includes(record.status ?? ""),
      );
      if (matched) claimedNotifications.add(matched.id);
    }

    items.push({
      id: `incoming:${record.id}`,
      direction: "incoming",
      kind: record.kind,
      headline: activityHeadline(record),
      detail: activityDetail(record),
      entry_title: record.entry_title,
      href: moderationHref(record),
      created_at: record.created_at,
      unread: Boolean(matched && !matched.read_at),
      notification_id: matched?.id ?? null,
    });
  }

  for (const notification of notifications) {
    if (claimedNotifications.has(notification.id)) continue;

    items.push({
      id: `notification:${notification.id}`,
      direction: "incoming",
      kind: notificationKind(notification),
      headline: notification.subject,
      detail: notification.body,
      entry_title: null,
      href: safeHref(notification.href),
      created_at: notification.created_at,
      unread: !notification.read_at,
      notification_id: notification.id,
    });
  }

  for (const record of outgoing) {
    items.push({
      id: `outgoing:${record.id}`,
      direction: "outgoing",
      kind: record.kind,
      headline: outgoingHeadline(record),
      detail: outgoingDetail(record),
      entry_title: record.entry_title,
      href: safeHref(record.href),
      created_at: record.created_at,
      unread: false,
      notification_id: null,
    });
  }

  return items.sort((a, b) => b.created_at - a.created_at).slice(0, 100);
}
