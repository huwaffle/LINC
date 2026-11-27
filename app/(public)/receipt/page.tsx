import Link from "next/link";
import { dismissReceipt } from "@/app/actions/receipts";
import { CopyButton } from "@/components/linc/copy-button";
import { EmptyState, Notice } from "@/components/linc/empty-state";
import { formatReceiptCode } from "@/lib/receipt-code";
import { readReceiptNotice } from "@/lib/receipts";
import { messageFrom } from "@/lib/redirects";

export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const code = await readReceiptNotice();
  const message = messageFrom({
    error: typeof sp.error === "string" ? sp.error : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });

  return (
    <div>
      <div className="sticky top-14 z-20 flex h-14 items-center border-b border-line bg-white/90 px-4 backdrop-blur md:top-0">
        <h1 className="text-[16px] font-bold tracking-[-0.01em] text-ink">Anonymous receipt</h1>
      </div>

      {message.text && (
        <Notice kind={message.kind === "error" ? "error" : "success"}>{message.text}</Notice>
      )}

      {!code ? (
        <EmptyState
          title="No receipt waiting"
          description="Receipts are shown once, right after an anonymous submission. If you already saved yours, open the tracking page."
          art="receipt"
          action={
            <Link
              href="/track"
              className="inline-flex rounded-full bg-linc-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-linc-700"
            >
              Track a receipt
            </Link>
          }
        />
      ) : (
        <div className="px-4 py-6">
          <p className="text-[14px] leading-relaxed text-neutral-600">
            Save this code. It is the only way to check the status of your anonymous entry — it is
            not linked to your account anywhere in LINC.
          </p>

          <div className="mt-5 rounded-2xl border border-line bg-canvas px-5 py-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Receipt code
            </p>
            <p className="mt-2 select-all font-mono text-[26px] font-bold tracking-[0.12em] text-ink">
              {formatReceiptCode(code)}
            </p>
            <div className="mt-4 flex justify-center">
              <CopyButton value={formatReceiptCode(code)} />
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-neutral-500">
            This device also remembers the code, so the tracking page can keep showing the status.
            Clearing the receipt removes that convenience copy only — the code above still works
            when entered manually.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <form action={dismissReceipt}>
              <button
                type="submit"
                className="rounded-full bg-linc-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-linc-700"
              >
                I saved the code
              </button>
            </form>
            <Link
              href="/track"
              className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink transition hover:bg-neutral-50"
            >
              Open tracking
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
