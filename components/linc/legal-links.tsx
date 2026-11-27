"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LEGAL_SECTIONS } from "@/lib/legal";
import { useFocusTrap } from "./use-focus-trap";

/** Footer links that open the Privacy Policy or Terms in a popup. */
export function LegalLinks() {
  const [openTitle, setOpenTitle] = useState<string | null>(null);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const section = LEGAL_SECTIONS.find((item) => item.title === openTitle) ?? null;

  useFocusTrap(dialogRef, Boolean(section));

  useEffect(() => {
    if (!section) return;
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenTitle(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus();
    };
  }, [section]);

  function open(event: React.MouseEvent<HTMLButtonElement>, title: string) {
    openerRef.current = event.currentTarget;
    setOpenTitle(title);
  }

  return (
    <>
      <p className="mt-10 text-center text-[11px] leading-relaxed text-neutral-400">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={(event) => open(event, LEGAL_SECTIONS[0].title)}
          className="font-semibold text-neutral-500 underline underline-offset-2 transition hover:text-ink"
        >
          Privacy Policy
        </button>
        {" · "}
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={(event) => open(event, LEGAL_SECTIONS[1].title)}
          className="font-semibold text-neutral-500 underline underline-offset-2 transition hover:text-ink"
        >
          Terms and Conditions
        </button>
      </p>

      {section &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpenTitle(null);
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-xl outline-none"
            >
              <h2 id={titleId} className="text-[16px] font-bold text-ink">
                {section.title}
              </h2>
              <div className="mt-3 max-h-[60vh] space-y-2.5 overflow-y-auto text-[13px] leading-relaxed text-neutral-600">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpenTitle(null)}
                  className="rounded-full bg-ink px-5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
