import Link from "next/link";
import { markAllNotificationsRead } from "@/app/actions/notifications";
import {
  ACTIVITY_FILTERS,
  activityCounts,
  filterActivity,
  type ActivityFeedItem,
  type ActivityFilter,
} from "@/lib/activity";
import { ActivityItem } from "./activity-item";
import { EmptyState } from "./empty-state";

/**
 * The shared Activity surface. It merges what the account did with the
 * reactions and notices it received, and keeps the mark-all-read control in
 * one place wherever the feed is rendered.
 */
export function ActivityPanel({
  items: allItems,
  unread,
  filter = "all",
  basePath = "/activity",
}: {
  items: ActivityFeedItem[];
  unread: number;
  filter?: ActivityFilter;
  /** Path (with any existing query) the filter tabs link back to. */
  basePath?: string;
}) {
  const counts = activityCounts(allItems);
  const items = filterActivity(allItems, filter);
  const join = basePath.includes("?") ? "&" : "?";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-2.5">
        <p className="text-[12px] leading-relaxed text-neutral-500">
          Everything you did — likes, replies, reposts, saves — and every reaction, reply, repost,
          or notice you received.
        </p>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
            >
              Mark all read
            </button>
          </form>
        )}
      </div>

      <nav
        aria-label="Filter activity"
        className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-3 py-2"
      >
        {ACTIVITY_FILTERS.map(({ value, label }) => {
          const { unread: n } = counts[value];
          return (
            <Link
              key={value}
              href={value === "all" ? basePath : `${basePath}${join}filter=${value}`}
              aria-current={filter === value ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                filter === value
                  ? "bg-ink text-white"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-ink"
              }`}
            >
              {label}
              {n > 0 && (
                <span
                  aria-label={`${n} unread`}
                  className="min-w-[18px] rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white"
                >
                  {n}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="When you like, reply, repost, or save something — or when someone reacts to your posts or an administrator updates its status — it will appear here."
          art="activity"
        />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <ActivityItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
