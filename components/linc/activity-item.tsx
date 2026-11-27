import Link from "next/link";
import { markNotificationRead } from "@/app/actions/notifications";
import { formatRelative } from "@/lib/format";
import type { ActivityFeedItem } from "@/lib/activity";
import {
  BookmarkIcon,
  CalendarIcon,
  CommentIcon,
  FlagIcon,
  HeartIcon,
  InboxIcon,
  PlusIcon,
  RepostIcon,
  ShieldIcon,
} from "./icons";

function KindIcon({ kind }: { kind: ActivityFeedItem["kind"] }) {
  if (kind === "like" || kind === "comment-like") {
    return <HeartIcon className="h-[18px] w-[18px]" filled />;
  }
  if (kind === "repost") return <RepostIcon className="h-[18px] w-[18px]" />;
  if (kind === "comment") return <CommentIcon className="h-[18px] w-[18px]" />;
  if (kind === "moderation") return <ShieldIcon className="h-[18px] w-[18px]" />;
  if (kind === "save") return <BookmarkIcon className="h-[18px] w-[18px]" />;
  if (kind === "post") return <PlusIcon className="h-[18px] w-[18px]" />;
  if (kind === "rsvp" || kind === "event") {
    return <CalendarIcon className="h-[18px] w-[18px]" />;
  }
  if (kind === "report") return <FlagIcon className="h-[18px] w-[18px]" />;
  return <InboxIcon className="h-[18px] w-[18px]" />;
}

function Label({ item }: { item: ActivityFeedItem }) {
  if (item.direction === "outgoing") {
    return (
      <span className="rounded-full border border-line px-2 py-0.5 font-semibold text-neutral-500">
        You
      </span>
    );
  }

  if (item.kind === "moderation") {
    return (
      <span className="rounded-full border border-linc-300 px-2 py-0.5 font-semibold text-linc-700">
        Update
      </span>
    );
  }

  if (item.kind === "like" || item.kind === "repost" || item.kind === "comment") {
    return (
      <span className="rounded-full border border-linc-300 px-2 py-0.5 font-semibold text-linc-700">
        Interaction
      </span>
    );
  }

  return (
    <span className="rounded-full border border-amber-300 px-2 py-0.5 font-semibold text-amber-800">
      Notification
    </span>
  );
}

export function ActivityItem({ item }: { item: ActivityFeedItem }) {
  return (
    <li
      className={`px-4 py-3.5 ${item.unread ? "bg-linc-50/40" : ""}`}
      data-activity-direction={item.direction}
      data-activity-kind={item.kind}
    >
      <div className="flex gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-canvas text-linc-700">
          <KindIcon kind={item.kind} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <Label item={item} />
            {item.unread && (
              <span className="rounded-full bg-linc-600 px-2 py-0.5 font-semibold text-white">
                unread
              </span>
            )}
            <span className="text-neutral-400">{formatRelative(item.created_at)}</span>
          </div>

          <p className="mt-1 text-[14px] font-semibold leading-snug text-ink">{item.headline}</p>

          {item.entry_title &&
            (item.href ? (
              <Link
                href={item.href}
                className="mt-1 block text-[14px] font-medium leading-snug text-ink hover:underline"
              >
                {item.entry_title}
              </Link>
            ) : (
              <p className="mt-1 text-[14px] font-medium leading-snug text-ink">
                {item.entry_title}
              </p>
            ))}

          {item.detail && (
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">{item.detail}</p>
          )}

          {item.unread && item.notification_id && (
            <form action={markNotificationRead} className="mt-2">
              <input type="hidden" name="id" value={item.notification_id} />
              <button
                type="submit"
                className="text-[12px] font-semibold text-neutral-500 transition hover:text-ink"
              >
                Mark as read
              </button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
