"use client";

import { useRef, useState } from "react";
import { LEGAL_SECTIONS } from "@/lib/legal";

/**
 * Replaces the form's submit button. Pressing it validates the form, then opens
 * the Privacy Policy and Terms; the account is only submitted from the dialog,
 * after the text is scrolled to the end and the box is ticked.
 *
 * `onValidate` swaps the native browser bubbles for the host form's own
 * checks (red boxes, shake, messages beside the boxes); without it the native
 * validation runs.
 */
export function TermsAgreement({
  label,
  onValidate,
}: {
  label: string;
  onValidate?: () => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  function show() {
    if (onValidate) {
      if (!onValidate()) return;
    } else {
      const form = buttonRef.current?.form;
      if (form && !form.reportValidity()) return;
    }
    setRead(false);
    setAgreed(false);
    setOpen(true);
  }

  function onScroll() {
    const el = boxRef.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 4) setRead(true);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={show}
        className="w-full rounded-full bg-linc-600 px-4 py-2.5 text-[15px] font-semibold text-white transition hover:bg-linc-700"
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="terms-title"
          onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
        >
          <div className="w-full max-w-[460px] rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="terms-title" className="text-[18px] font-black tracking-[-0.03em] text-ink">
              Privacy Policy and Terms
            </h2>
            <p className="mt-1 text-[12px] text-neutral-500">
              Please read everything below before creating your account.
            </p>

            <div
              ref={boxRef}
              onScroll={onScroll}
              tabIndex={0}
              className="mt-3 h-64 overflow-y-auto rounded-xl border border-line px-3.5 py-3 text-[12px] leading-relaxed text-neutral-600"
            >
              {LEGAL_SECTIONS.map((section) => (
                <section key={section.title} className="mb-3">
                  <h3 className="mb-1 text-[13px] font-bold text-ink">{section.title}</h3>
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="mb-1.5">
                      {paragraph}
                    </p>
                  ))}
                </section>
              ))}
              <p className="text-[11px] font-semibold text-neutral-400">End of document.</p>
            </div>

            <label
              className={`mt-3 flex items-start gap-2 text-[12px] ${read ? "text-ink" : "text-neutral-400"}`}
            >
              <input
                type="checkbox"
                name="agree"
                disabled={!read}
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                I have read and agree to the Privacy Policy and Terms and Conditions.
                {!read && (
                  <span className="block text-[11px]">Scroll to the end of the text to enable this box.</span>
                )}
              </span>
            </label>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-line px-4 py-2.5 text-[14px] font-semibold text-ink transition hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!agreed}
                className="flex-1 rounded-full bg-linc-600 px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-linc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Agree and create account
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
