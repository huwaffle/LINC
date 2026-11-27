"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Local replacement for Supabase Realtime. Re-renders the server component
 * tree so discussion posts and moderation decisions stay fresh without a
 * websocket server running on the machine. Polling pauses while the tab is
 * hidden and refreshes immediately when the user comes back.
 */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = setInterval(() => router.refresh(), seconds * 1000);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        router.refresh();
        start();
      }
    };

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, seconds]);

  return null;
}
