"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Cause = "checking" | "offline" | "server" | "generic";

/**
 * Shared body for every error.tsx. It checks /api/health so a down local
 * server or database gets a plain-language message instead of a generic one.
 */
export function ErrorPanel({
  error,
  retry,
  fullPage = false,
}: {
  error: unknown;
  retry: () => void;
  fullPage?: boolean;
}) {
  const [cause, setCause] = useState<Cause>("checking");

  useEffect(() => {
    console.error(error);
    if (!navigator.onLine) {
      setCause("offline");
      return;
    }
    const controller = new AbortController();
    void fetch("/api/health", { cache: "no-store", signal: controller.signal })
      .then((response) => setCause(response.ok ? "generic" : "server"))
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setCause("server");
      });
    return () => controller.abort();
  }, [error]);

  const copy = {
    checking: ["Something went wrong", "Checking what happened…"],
    offline: ["You appear to be offline", "Check your connection, then try again."],
    server: [
      "LINC cannot reach the application or database",
      "Make sure the app is running and the Supabase connection is configured, then try again.",
    ],
    generic: [
      "Something went wrong",
      "This page failed to load. It is usually temporary, so trying again often works.",
    ],
  }[cause];

  return (
    <div
      role="alert"
      className={`mx-auto flex max-w-sm flex-col items-center justify-center px-6 text-center ${
        fullPage ? "min-h-screen" : "py-20"
      }`}
    >
      <span className="text-[30px] font-black tracking-[-0.04em] text-linc-600">LINC</span>
      <h1 className="mt-5 text-[20px] font-bold tracking-[-0.02em] text-ink">{copy[0]}</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">{copy[1]}</p>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-full bg-linc-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-linc-700"
        >
          Retry
        </button>
        <Link
          href="/"
          className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink transition hover:bg-neutral-50"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
