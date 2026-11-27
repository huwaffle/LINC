"use client";

import { useEffect, useState } from "react";

/**
 * Small polling badge for the Activity link. The server supplies the initial
 * count so the first paint is correct; a 30-second poll keeps it fresh while
 * the tab is visible, and it refreshes on focus. Rendering nothing at zero removes the badge automatically.
 */
export function ActivityCountBadge({
  initial,
  className,
}: {
  initial: number;
  className?: string;
}) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    setCount(initial);
  }, [initial]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/activity/unread", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { unread?: number };
        if (active) setCount(Math.max(0, Number(data.unread) || 0));
      } catch {
        // Offline or a transient error: keep the last known count.
      }
    };

    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = setInterval(load, 30_000);
    };
    const onVisibility = async () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        await load();
        start();
      }
    };

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", load);
    };
  }, []);

  if (count <= 0) return null;

  return <span className={className}>{count > 9 ? "9+" : count}</span>;
}
