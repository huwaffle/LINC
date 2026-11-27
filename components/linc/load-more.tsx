"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { loadMoreEntries, type FeedSource } from "@/app/actions/feed";
import { LoadMoreSkeleton } from "./skeletons";

/**
 * Cursor-based "Load more" for post lists. The first page is rendered by the
 * server; later pages are fetched on demand and appended below it.
 */
export function LoadMore({
  source,
  param = "",
  initialCursor,
  children,
}: {
  source: FeedSource;
  param?: string;
  initialCursor: string | null;
  children?: ReactNode;
}) {
  const [extra, setExtra] = useState<ReactNode>(null);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [pages, setPages] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pending, start] = useTransition();
  const mounted = useRef(false);

  function load() {
    if (!cursor) return;
    setFailed(false);
    setLoadingMore(true);
    start(async () => {
      try {
        const next = await loadMoreEntries(source, param, cursor, 1);
        setExtra((current: ReactNode) => (
          <>
            {current}
            {next.node}
          </>
        ));
        setCursor(next.nextCursor);
        setPages((n) => n + 1);
      } catch {
        setFailed(true);
      } finally {
        setLoadingMore(false);
      }
    });
  }

  // The server tree re-renders after likes, saves and reposts; reload the
  // appended pages so their buttons reflect the new state.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (pages === 0 || !initialCursor) return;
    start(async () => {
      try {
        const all = await loadMoreEntries(source, param, initialCursor, pages);
        setExtra(all.node);
        setCursor(all.nextCursor);
      } catch {
        // Keep the posts that are already on screen.
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  return (
    <>
      {children}
      {extra}
      {loadingMore && <LoadMoreSkeleton />}
      {(cursor || failed) && (
        <div className="flex flex-col items-center gap-2 px-4 py-5">
          {failed && (
            <p role="alert" className="text-[13px] text-rose-700">
              Could not load more posts. Check your connection and try again.
            </p>
          )}
          <button
            type="button"
            onClick={load}
            disabled={pending}
            className="rounded-full border border-line px-5 py-2 text-[13px] font-semibold text-ink transition hover:bg-neutral-50 disabled:opacity-60"
          >
            {pending ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
