"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "./use-focus-trap";

function ConfirmDialog({
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  useFocusTrap(dialogRef);

  useEffect(() => {
    cancelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-xl"
      >
        <h2 id={titleId} className="text-[16px] font-bold text-ink">
          Are you sure?
        </h2>
        <p id={descId} className="mt-1.5 text-[14px] leading-relaxed text-neutral-600">
          {message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink transition hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-rose-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * A button that asks for confirmation in an accessible dialog before it
 * submits its parent form. Server actions stay in the form; only the
 * confirmation step runs on the client.
 */
export function ConfirmSubmit({
  message,
  className,
  confirmLabel = "Delete",
  children,
}: {
  message: string;
  className?: string;
  confirmLabel?: string;
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
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open && (
        <ConfirmDialog
          message={message}
          confirmLabel={confirmLabel}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            setOpen(false);
            buttonRef.current?.form?.requestSubmit();
          }}
        />
      )}
    </>
  );
}
