"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Entry = { q: string; qs: string };

const RECENT_KEY = "linc-recent-searches";
const SAVED_KEY = "linc-saved-searches";
const RECENT_MAX = 6;
const SAVED_MAX = 10;

function read(key: string): Entry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (e): e is Entry => typeof e?.q === "string" && typeof e?.qs === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function write(key: string, entries: Entry[]) {
  try {
    localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    // Storage full or blocked: history is a convenience, so ignore it.
  }
}

/**
 * Recent and saved searches, kept only in this browser. With a query it
 * records the search and offers Save; without one it lists both groups.
 */
export function SearchHistory({ q, qs }: { q: string; qs: string }) {
  const [recent, setRecent] = useState<Entry[]>([]);
  const [saved, setSaved] = useState<Entry[]>([]);

  useEffect(() => {
    let nextRecent = read(RECENT_KEY);
    if (q) {
      nextRecent = [{ q, qs }, ...nextRecent.filter((e) => e.qs !== qs)].slice(0, RECENT_MAX);
      write(RECENT_KEY, nextRecent);
    }
    setRecent(nextRecent);
    setSaved(read(SAVED_KEY));
  }, [q, qs]);

  const isSaved = saved.some((e) => e.qs === qs);

  const toggleSaved = useCallback(() => {
    const next = isSaved
      ? saved.filter((e) => e.qs !== qs)
      : [{ q, qs }, ...saved].slice(0, SAVED_MAX);
    write(SAVED_KEY, next);
    setSaved(next);
  }, [isSaved, saved, q, qs]);

  function remove(key: string, list: Entry[], set: (e: Entry[]) => void, entry: Entry) {
    const next = list.filter((e) => e.qs !== entry.qs);
    write(key, next);
    set(next);
  }

  function clear(key: string, set: (e: Entry[]) => void) {
    write(key, []);
    set([]);
  }

  if (q) {
    return (
      <div className="flex justify-end border-b border-line px-4 py-2">
        <button
          type="button"
          onClick={toggleSaved}
          aria-pressed={isSaved}
          className="rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
        >
          {isSaved ? "Saved search ✓" : "Save this search"}
        </button>
      </div>
    );
  }

  const groups = [
    { title: "Saved searches", key: SAVED_KEY, list: saved, set: setSaved },
    { title: "Recent searches", key: RECENT_KEY, list: recent, set: setRecent },
  ].filter((g) => g.list.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="border-b border-line">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.title} className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
              {group.title}
            </h2>
            <button
              type="button"
              onClick={() => clear(group.key, group.set)}
              className="text-[12px] font-semibold text-neutral-500 transition hover:text-ink"
            >
              Clear all
            </button>
          </div>
          <ul className="mt-1 divide-y divide-line">
            {group.list.map((entry) => (
              <li key={entry.qs} className="flex items-center gap-2">
                <Link
                  href={`/search?${entry.qs}`}
                  className="min-w-0 flex-1 truncate py-2 text-[14px] text-ink hover:underline"
                >
                  {entry.q}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(group.key, group.list, group.set, entry)}
                  aria-label={`Remove ${entry.q}`}
                  className="grid h-7 w-7 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-ink"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
