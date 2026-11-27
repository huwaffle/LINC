export const dynamic = "force-dynamic";

import Link from "next/link";
import { toggleRsvp } from "@/app/actions/social";
import { PageHeader } from "@/components/linc/page-header";
import { EmptyState, Notice } from "@/components/linc/empty-state";
import { EmptyArt } from "@/components/linc/empty-art";
import { CheckIcon } from "@/components/linc/icons";
import { getSession } from "@/lib/auth/session";
import {
  hasRsvp,
  listEvents,
  listEventsBetween,
  type EventRecord,
} from "@/lib/db/queries";
import { daysUntil, formatDateTime, formatTime } from "@/lib/format";
import { messageFrom } from "@/lib/redirects";
import { listEventsForYou } from "@/lib/recommend/db";

const MANILA = "Asia/Manila";
const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type MonthWindow = {
  year: number;
  month: number;
  label: string;
  start: number;
  end: number;
  prev: string;
  next: string;
};

function monthWindow(raw: string | undefined): MonthWindow {
  const now = DAY_FORMAT.format(new Date());
  const fallback = now.slice(0, 7);
  const match = /^(\d{4})-(\d{2})$/.exec(raw ?? "");
  const year = match ? Number(match[1]) : Number(fallback.slice(0, 4));
  const month = match ? Number(match[2]) : Number(fallback.slice(5, 7));
  const safeMonth = Math.min(12, Math.max(1, month));
  const start = Date.UTC(year, safeMonth - 1, 1) - 8 * 3_600_000;
  const end = Date.UTC(year, safeMonth, 1) - 8 * 3_600_000;
  const prevDate = new Date(Date.UTC(year, safeMonth - 2, 1));
  const nextDate = new Date(Date.UTC(year, safeMonth, 1));
  const key = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

  return {
    year,
    month: safeMonth,
    label: new Date(Date.UTC(year, safeMonth - 1, 1)).toLocaleDateString("en-PH", {
      month: "long",
      year: "numeric",
      timeZone: MANILA,
    }),
    start,
    end,
    prev: key(prevDate),
    next: key(nextDate),
  };
}

function eventDay(ms: number): string {
  return DAY_FORMAT.format(new Date(ms));
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    notice?: string;
    error?: string;
    view?: string;
    month?: string;
  }>;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const view = sp.view === "calendar" ? "calendar" : "list";
  const monthView = monthWindow(typeof sp.month === "string" ? sp.month : undefined);
  const message = messageFrom({
    error: typeof sp.error === "string" ? sp.error : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });

  const events = await listEventsForYou(session?.id);
  const monthEvents = await listEventsBetween(monthView.start, monthView.end);
  const eventsByDay = new Map<string, EventRecord[]>();
  for (const event of monthEvents) {
    const day = eventDay(event.starts_at);
    const bucket = eventsByDay.get(day) ?? [];
    bucket.push(event);
    eventsByDay.set(day, bucket);
  }

  const daysInMonth = new Date(Date.UTC(monthView.year, monthView.month, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(monthView.year, monthView.month - 1, 1)).getUTCDay() + 6) % 7;
  const todayKey = DAY_FORMAT.format(new Date());
  const showPublish = session?.role === "admin";

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle={view === "calendar" ? monthView.label : undefined}
        actions={
          <>
            <Link
              href={view === "calendar" ? "/events" : "/events?view=calendar"}
              className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
            >
              {view === "calendar" ? "List" : "Calendar"}
            </Link>
            {showPublish && (
              <Link
                href="/admin/events/new"
                className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
              >
                Publish
              </Link>
            )}
          </>
        }
      />

      {message.text && (
        <Notice kind={message.kind === "error" ? "error" : "success"}>{message.text}</Notice>
      )}

      {view === "calendar" ? (
        <section>
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <Link
              href={`/events?view=calendar&month=${monthView.prev}`}
              className="rounded-full px-2 py-1 text-[12px] font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-ink"
            >
              Previous
            </Link>
            <p className="text-[13px] font-semibold text-ink">{monthView.label}</p>
            <Link
              href={`/events?view=calendar&month=${monthView.next}`}
              className="rounded-full px-2 py-1 text-[12px] font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-ink"
            >
              Next
            </Link>
          </div>

          <div className="grid grid-cols-7 border-b border-line bg-canvas text-center">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div
                key={day}
                className="py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: leading }, (_, index) => (
              <div key={`blank-${index}`} className="min-h-[84px] border-b border-r border-line" />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const key = `${monthView.year}-${String(monthView.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayEvents = eventsByDay.get(key) ?? [];
              const isToday = key === todayKey;

              return (
                <div
                  key={key}
                  className={`min-h-[84px] border-b border-r border-line p-1 ${
                    isToday ? "bg-linc-50/50" : ""
                  }`}
                >
                  <p
                    className={`px-0.5 text-[11px] font-semibold ${
                      isToday ? "text-linc-700" : "text-neutral-400"
                    }`}
                  >
                    {day}
                  </p>
                  <div className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <Link
                        key={event.id}
                        href={`/events/${event.id}`}
                        title={event.title}
                        className="block truncate rounded bg-linc-50 px-1 py-0.5 text-[10px] font-medium text-linc-700 transition hover:bg-linc-100"
                      >
                        {formatTime(event.starts_at)} {event.title}
                      </Link>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="px-1 text-[10px] text-neutral-400">
                        +{dayEvents.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {monthEvents.length === 0 && (
            <div className="flex flex-col items-center border-t border-line px-4 py-6 text-center">
              <EmptyArt variant="events" className="h-16 w-20" />
              <p className="mt-2 text-[13px] text-neutral-500">No events scheduled this month.</p>
            </div>
          )}
        </section>
      ) : events.length === 0 ? (
        <EmptyState
          title="No upcoming events"
          description="Events will appear here once they are published."
          art="events"
        />
      ) : (
        <div className="divide-y divide-line">
          {events.map(async (event) => {
            const reserved = session ? await hasRsvp(event.id, session.id) : false;
            const days = daysUntil(event.starts_at);
            const date = new Date(event.starts_at);

            return (
              <article key={event.id} className="flex gap-3 px-4 py-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-line bg-canvas text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-linc-600">
                    {date.toLocaleDateString("en-PH", {
                      month: "short",
                      timeZone: MANILA,
                    })}
                  </span>
                  <span className="block text-[19px] font-bold leading-none text-ink">
                    {date.toLocaleDateString("en-PH", {
                      day: "numeric",
                      timeZone: MANILA,
                    })}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                    <span className="text-neutral-500">{formatDateTime(event.starts_at)}</span>
                    {days >= 0 && (
                      <span className="text-neutral-400">
                        {days === 0 ? "Today" : `in ${days}d`}
                      </span>
                    )}
                  </div>

                  <h2 className="mt-1 text-[15px] font-semibold leading-snug text-ink">
                    <Link href={`/events/${event.id}`} className="transition hover:underline">
                      {event.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-[14px] leading-[1.45] text-neutral-600">
                    {event.description}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-neutral-500">
                    <span>{event.location}</span>
                    <span>{event.rsvp_count} going</span>
                    <Link
                      href={`/events/${event.id}`}
                      className="font-semibold text-linc-700 hover:underline"
                    >
                      Details
                    </Link>
                    {event.registration_url && (
                      <a
                        href={event.registration_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-linc-700 hover:underline"
                      >
                        Registration link
                      </a>
                    )}
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {session ? (
                      <form action={toggleRsvp}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="returnTo" value="/events" />
                        <button
                          type="submit"
                          title={reserved ? "Click to cancel" : "Mark yourself as going"}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                            reserved
                              ? "border border-linc-300 bg-linc-50 text-linc-700 hover:bg-linc-100"
                              : "bg-linc-600 text-white hover:bg-linc-700"
                          }`}
                        >
                          {reserved ? (
                            <>
                              <CheckIcon className="h-4 w-4" />
                              Going
                            </>
                          ) : (
                            "I am going"
                          )}
                        </button>
                      </form>
                    ) : (
                      <Link
                        href="/login?next=/events"
                        className="inline-flex rounded-full bg-linc-600 px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-linc-700"
                      >
                        Sign in to join
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
