export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { toggleRsvp } from "@/app/actions/social";
import { Avatar } from "@/components/linc/avatar";
import { Notice } from "@/components/linc/empty-state";
import { PageHeader } from "@/components/linc/page-header";
import { CalendarIcon, CheckIcon } from "@/components/linc/icons";
import { getSession } from "@/lib/auth/session";
import { getEvent, hasRsvp, listEventAttendees } from "@/lib/db/queries";
import { avatarSrc } from "@/lib/avatars";
import { daysUntil, formatDateTime } from "@/lib/format";
import { messageFrom } from "@/lib/redirects";
import { recordView } from "@/lib/recommend/db";

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const event = await getEvent(id);
  if (!event) notFound();

  const session = await getSession();
  if (session) await recordView(session.id, "event", event.id);
  const reserved = session ? await hasRsvp(event.id, session.id) : false;
  const attendees = await listEventAttendees(event.id);
  const days = daysUntil(event.starts_at);
  const message = messageFrom({
    error: typeof sp.error === "string" ? sp.error : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });
  const returnTo = `/events/${event.id}`;

  return (
    <div>
      <PageHeader
        title="Event"
        backHref="/events"
        backLabel="Back to events"
        actions={
          <Link
            href={`/api/events/${event.id}/ics`}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
          >
            <CalendarIcon className="h-4 w-4" />
            Add to calendar
          </Link>
        }
      />

      {message.text && (
        <Notice kind={message.kind === "error" ? "error" : "success"}>{message.text}</Notice>
      )}

      <article className="px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-line bg-canvas text-center">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-linc-600">
              {new Date(event.starts_at).toLocaleDateString("en-PH", {
                month: "short",
                timeZone: "Asia/Manila",
              })}
            </span>
            <span className="block text-[22px] font-bold leading-none text-ink">
              {new Date(event.starts_at).toLocaleDateString("en-PH", {
                day: "numeric",
                timeZone: "Asia/Manila",
              })}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] text-neutral-500">
              {formatDateTime(event.starts_at)}
              {days >= 0 && (
                <span className="text-neutral-400">
                  {days === 0 ? " · Today" : ` · in ${days}d`}
                </span>
              )}
            </p>
          </div>
        </div>

        <h1 className="mt-4 text-[22px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">
          {event.title}
        </h1>

        <p className="mt-1.5 text-[13px] font-medium text-neutral-600">{event.location}</p>

        <div className="mt-3 space-y-3 text-[15px] leading-[1.55] text-neutral-800">
          {event.description.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        {event.registration_url && (
          <a
            href={event.registration_url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-linc-700 hover:underline"
          >
            Open registration link
          </a>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {session ? (
            <form action={toggleRsvp}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button
                type="submit"
                title={reserved ? "Click to cancel" : "Mark yourself as going"}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition ${
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
              href={`/login?next=${encodeURIComponent(returnTo)}`}
              className="rounded-full bg-linc-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-linc-700"
            >
              Sign in to join
            </Link>
          )}
          <span className="text-[13px] text-neutral-500">
            <span className="font-semibold text-ink">{event.rsvp_count}</span>{" "}
            {event.rsvp_count === 1 ? "person going" : "people going"}
          </span>
        </div>

        <section className="mt-6 border-t border-line pt-4">
          <h2 className="text-[13px] font-semibold text-neutral-500">Who is going</h2>
          {attendees.length === 0 ? (
            <p className="mt-2 text-[13px] text-neutral-400">
              No one has marked going yet. Anonymous accounts never appear in this list.
            </p>
          ) : (
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {attendees.map((attendee) => (
                <li key={attendee.id}>
                  <Link
                    href={`/u/${attendee.username}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line py-1 pl-1 pr-2.5 text-[12px] font-medium text-ink transition hover:bg-neutral-50"
                  >
                    <Avatar
                      name={attendee.display_name}
                      src={avatarSrc(attendee.id, attendee.has_avatar)}
                      size={22}
                    />
                    {attendee.display_name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>
    </div>
  );
}
