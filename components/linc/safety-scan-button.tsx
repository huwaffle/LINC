"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button for the admin safety scan. While the server action runs,
 * `useFormStatus` reports pending so the button disables itself and swaps to a
 * spinner, which stops duplicate scans and makes the wait visible.
 */
export function SafetyScanButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:cursor-progress disabled:opacity-70"
    >
      {pending ? (
        <>
          <svg
            className="h-3.5 w-3.5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-90"
              fill="currentColor"
              d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
            />
          </svg>
          Scanning posts, comments &amp; accounts…
        </>
      ) : (
        "Scan all posts, comments & accounts"
      )}
    </button>
  );
}
