export const dynamic = "force-dynamic";

import Link from "next/link";
import { markOutboxRead } from "@/app/actions/admin";
import { EmptyState, Notice } from "@/components/linc/empty-state";
import { listOutbox } from "@/lib/db/queries";
import { formatDateTime } from "@/lib/format";
import { messageFrom } from "@/lib/redirects";

export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const messages = await listOutbox(60);
  const unread = messages.filter((message) => !message.read_at).length;
  const notice = messageFrom({
    error: typeof sp.error === "string" ? sp.error : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });

  return (
    <div>
      <div className="flex items-end justify-between gap-3 px-4 py-4">
        <div>
          <h1 className="text-[19px] font-bold tracking-[-0.02em] text-ink">Local outbox</h1>
          <p className="text-[13px] leading-relaxed text-neutral-500">
            Admin reports and system messages, captured locally. {unread} unread.
          </p>
        </div>
        {unread > 0 && (
          <form action={markOutboxRead}>
            <button
              type="submit"
              className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
            >
              Mark all as read
            </button>
          </form>
        )}
      </div>

      {notice.text && (
        <Notice kind={notice.kind === "error" ? "error" : "success"}>{notice.text}</Notice>
      )}

      <p className="border-y border-line bg-canvas px-4 py-2.5 text-[12px] leading-relaxed text-linc-700">
        Run <code className="rounded bg-white px-1 py-0.5">npm run worker</code> to sweep due
        reminders every 60 seconds, or POST to{" "}
        <code className="rounded bg-white px-1 py-0.5">/api/jobs/reminders</code>. Personal
        reminders and moderation decisions appear in each student&apos;s activity feed.
      </p>

      {messages.length === 0 ? (
        <EmptyState
          title="Nothing in the outbox yet"
          description="Reminders and moderation notices are captured here when the worker runs or an administrator makes a decision."
          art="receipt"
        />
      ) : (
        <ul className="divide-y divide-line">
          {messages.map((message) => (
            <li key={message.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded-full border border-line px-2 py-0.5 font-semibold capitalize text-neutral-500">
                  {message.kind.replace("-", " ")}
                </span>
                {!message.read_at && (
                  <span className="rounded-full bg-linc-600 px-2 py-0.5 font-semibold text-white">
                    unread
                  </span>
                )}
                <span className="text-neutral-400">{formatDateTime(message.created_at)}</span>
                {message.to_role && (
                  <span className="text-neutral-400">to {message.to_role}</span>
                )}
              </div>
              <p className="mt-1 text-[14px] font-semibold text-ink">{message.subject}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-600">{message.body}</p>
              {message.href && message.href.startsWith("/") && !message.href.startsWith("//") && (
                <Link
                  href={message.href}
                  className="mt-1 inline-block text-[12px] font-semibold text-linc-700 hover:underline"
                >
                  Open related page
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
