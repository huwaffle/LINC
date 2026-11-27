"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "./icons";

/** Goes back to the previous page; falls back to `fallbackHref` when there is no history. */
export function BackButton({ fallbackHref = "/", className = "" }: { fallbackHref?: string; className?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label="Go back"
      title="Back"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink transition hover:bg-neutral-100 ${className}`}
    >
      <ArrowLeftIcon className="h-5 w-5" />
    </button>
  );
}
