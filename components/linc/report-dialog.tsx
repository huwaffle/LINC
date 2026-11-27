"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { refreshAfterReport, reportEntry } from "@/app/actions/social";
import { useFocusTrap } from "./use-focus-trap";

const MAX_REASON = 500;
const MIN_REASON = 5;

function ReportModal({ entryId, slug, onClose }: { entryId: string; slug: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const [reason, setReason] = useState("");
  const [state, formAction, pending] = useActionState(reportEntry, null);
  const router = useRouter();
  const pathname = usePathname();
  const valid = reason.trim().length >= MIN_REASON;
  const sent = Boolean(state?.ok);

  function close() {
    onClose();
    if (!sent) return;
    // The reported post is back in the moderation queue, so leave its page.
    const onPostPage = pathname.endsWith(`/${entryId}`);
    void refreshAfterReport().then(() => (onPostPage ? router.push("/") : router.refresh()));
  }
  const closeRef = useRef(close);
  closeRef.current = close;

  useFocusTrap(dialogRef);

  useEffect(() => {
    textRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <form
        ref={dialogRef}
        action={formAction}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-xl"
      >
        {sent ? (
          <div className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 id={titleId} className="mt-3 text-[16px] font-bold text-ink">
              Post reported
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-600">
              Thanks for letting us know. This post has been reported and returned to the moderation queue, where an administrator will review it again.
            </p>
            <button
              type="button"
              autoFocus
              onClick={close}
              className="mt-5 rounded-full bg-ink px-5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
            >
              Done
            </button>
          </div>
        ) : (
          <>
        <input type="hidden" name="entryId" value={entryId} />
        <input type="hidden" name="slug" value={slug} />
        <h2 id={titleId} className="text-[16px] font-bold text-ink">
          Report this post
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-600">
          Tell the administrator why this post should be reviewed again. A reason is required.
        </p>
        <label htmlFor={`${titleId}-reason`} className="mt-4 block text-[13px] font-semibold text-ink">
          Reason for reporting
        </label>
        <textarea
          ref={textRef}
          id={`${titleId}-reason`}
          name="reason"
          rows={4}
          required
          minLength={MIN_REASON}
          maxLength={MAX_REASON}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why should an administrator review this post again?"
          className="mt-1.5 w-full resize-none rounded-xl border border-line px-3 py-2 text-[14px] text-ink placeholder:text-neutral-400 outline-none transition focus:border-linc-400 focus:ring-4 focus:ring-linc-50"
        />
        <p className="mt-1 text-right text-[12px] text-neutral-400">
          {reason.length}/{MAX_REASON}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink transition hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || pending}
            className="rounded-full bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send report
          </button>
        </div>
          </>
        )}
      </form>
    </div>,
    document.body,
  );
}

/** Opens a popup that requires a reason before the report is submitted. */
export function ReportButton({
  entryId,
  slug,
  className,
  children,
}: {
  entryId: string;
  slug: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        className={className}
        onClick={() => {
          buttonRef.current?.closest("details")?.removeAttribute("open");
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open && <ReportModal entryId={entryId} slug={slug} onClose={() => setOpen(false)} />}
    </>
  );
}
