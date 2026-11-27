import Link from "next/link";
import {
  forgetMissingReceipt,
  stopTracking,
  trackReceipt,
} from "@/app/actions/receipts";
import { EmptyState, Notice } from "@/components/linc/empty-state";
import { findReceipt, readTrackedCode, type ReceiptStatus } from "@/lib/receipts";
import { formatDateTime } from "@/lib/format";
import { messageFrom } from "@/lib/redirects";

const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for admin review",
  published: "Published",
  rejected: "Returned for revision",
  redacted: "Removed",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-800",
  published: "border-linc-300 bg-linc-50 text-linc-700",
  rejected: "border-rose-300 bg-rose-50 text-rose-700",
  redacted: "border-neutral-300 bg-neutral-100 text-neutral-600",
};

function StatusCard({ receipt }: { receipt: ReceiptStatus }) {
  const label = STATUS_LABEL[receipt.status] ?? receipt.status;
  const style = STATUS_STYLE[receipt.status] ?? STATUS_STYLE.pending;

  return (
    <div className="px-4 py-6">
      <div className="rounded-2xl border border-line p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style}`}
          >
            {label}
          </span>
          <span className="text-[12px] text-neutral-400">
            updated {formatDateTime(receipt.updated_at)}
          </span>
        </div>

        <h2 className="mt-3 text-[18px] font-bold leading-snug tracking-[-0.02em] text-ink">
          {receipt.title}
        </h2>
        <p className="mt-1 text-[13px] text-neutral-500">
          {receipt.category_label}
        </p>

        {receipt.status === "rejected" && receipt.reject_reason && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] leading-relaxed text-rose-800">
            <span className="font-semibold">Returned by the USC administrator:</span>{" "}
            {receipt.reject_reason}
          </div>
        )}

        {receipt.status === "redacted" && receipt.reject_reason && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] leading-relaxed text-rose-800">
            <span className="font-semibold">This post will be deleted due to:</span>{" "}
            {receipt.reject_reason}
          </div>
        )}

        <p className="mt-4 text-[13px] leading-relaxed text-neutral-500">
          {receipt.status === "pending"
            ? "Your entry is in the admin queue. Check back here after it is reviewed."
            : receipt.status === "published"
              ? "Your entry is now visible on the public feed. This receipt stays available for reference."
              : receipt.status === "rejected"
                ? "You can use the feedback above to revise and submit a new entry."
                : "This entry is no longer publicly visible."}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Link
          href="/"
          className="rounded-full bg-linc-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-linc-700"
        >
          Back to the feed
        </Link>
        <form action={stopTracking}>
          <button
            type="submit"
            className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-neutral-600 transition hover:bg-neutral-50"
          >
            Stop tracking on this device
          </button>
        </form>
      </div>
    </div>
  );
}

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const code = await readTrackedCode();
  const receipt = code ? await findReceipt(code) : undefined;
  const message = messageFrom({
    error: typeof sp.error === "string" ? sp.error : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });

  return (
    <div>
      <div className="sticky top-14 z-20 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur md:top-0">
        <h1 className="text-[16px] font-bold tracking-[-0.01em] text-ink">Track a post</h1>
        <Link
          href="/submit"
          className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
        >
          New post
        </Link>
      </div>

      {message.text && (
        <Notice kind={message.kind === "error" ? "error" : "success"}>{message.text}</Notice>
      )}

      {receipt ? (
        <StatusCard receipt={receipt} />
      ) : (
        <div className="px-4 py-6">
          {code && (
            <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] leading-relaxed text-amber-800">
              The code saved on this device does not match a post anymore.
            </div>
          )}

          <p className="text-[14px] leading-relaxed text-neutral-600">
            Enter the 12-character tracking code you received when you submitted a post. Tracking
            does not need a sign-in. Anonymous posts use a private receipt code that is never
            shown on the post itself.
          </p>

          <form action={trackReceipt} className="mt-5">
            <label htmlFor="code" className="block text-[11px] font-semibold text-neutral-500">
              Tracking code
            </label>
            <input
              id="code"
              name="code"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX"
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 font-mono text-[16px] uppercase tracking-[0.08em] text-ink outline-none focus:border-linc-400"
            />
            <button
              type="submit"
              className="mt-3 rounded-full bg-linc-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-linc-700"
            >
              Track this post
            </button>
          </form>

          {code && (
            <form action={forgetMissingReceipt} className="mt-4 border-t border-line pt-4">
              <button
                type="submit"
                className="text-[12px] font-semibold text-neutral-500 underline-offset-2 hover:underline"
              >
                Clear the saved receipt
              </button>
            </form>
          )}

          <div className="mt-8 border-t border-line pt-4">
            <EmptyState
              title="How tracking codes work"
              description="Every post gets a tracking code when it is submitted. Signed-in authors are also notified of each status change. Anonymous posts cannot be linked to an account, so keep your receipt code somewhere safe."
              art="receipt"
            />
          </div>
        </div>
      )}
    </div>
  );
}
