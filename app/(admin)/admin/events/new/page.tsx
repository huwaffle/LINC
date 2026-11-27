import Link from "next/link";
import { EventForm } from "@/components/linc/event-form";
import { Notice } from "@/components/linc/empty-state";
import { ArrowLeftIcon } from "@/components/linc/icons";
import { requireRole } from "@/lib/auth/session";
import { messageFrom } from "@/lib/redirects";

export default async function AdminNewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("admin");
  const sp = await searchParams;
  const message = messageFrom({ error: typeof sp.error === "string" ? sp.error : undefined });

  return (
    <div>
      <div className="sticky top-14 z-20 flex h-14 items-center gap-2 border-b border-line bg-white/90 px-2 backdrop-blur md:top-0">
        <Link
          href="/events"
          aria-label="Back to events"
          className="grid h-9 w-9 place-items-center rounded-full text-ink transition hover:bg-neutral-100"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <p className="text-[15px] font-bold tracking-[-0.01em] text-ink">New event</p>
      </div>

      <div className="px-4 py-4">
        <h1 className="text-[20px] font-bold tracking-[-0.02em] text-ink">Publish an event</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
          Events appear on the public calendar. Students who mark themselves as going receive a
          reminder in the local outbox one day before the event.
        </p>

        {message.text && <Notice kind="error">{message.text}</Notice>}

        <EventForm />
      </div>
    </div>
  );
}
