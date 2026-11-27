"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadMoreReels } from "@/app/actions/feed";
import type { ReelSlideData } from "./reel-slide";

const AUTO_KEY = "linc-reels-auto";
const NO_INPUT = /^(INPUT|TEXTAREA|SELECT|VIDEO)$/;

/**
 * One post at a time, TikTok style. Scroll or swipe snaps between posts; on
 * desktop the arrow keys (and J / K) or the side buttons move too. With
 * auto-scroll switched on, a bar at the top counts down each post's viewing
 * time (set by its length and media) and then moves to the next post.
 */
export function ReelsViewer({
  slides,
  param = "",
  initialCursor,
}: {
  slides: ReelSlideData[];
  param?: string;
  initialCursor: string | null;
}) {
  const [extra, setExtra] = useState<ReelSlideData[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [pages, setPages] = useState(0);
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [videoSeconds, setVideoSeconds] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const loading = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    setAuto(localStorage.getItem(AUTO_KEY) === "1");
  }, []);

  const toggleAuto = () => {
    setAuto((on) => {
      localStorage.setItem(AUTO_KEY, on ? "0" : "1");
      return !on;
    });
  };

  const all = [...slides, ...extra];
  const active = all[Math.min(index, all.length - 1)];
  const seconds = active ? Math.max(active.seconds, videoSeconds ?? 0) : 0;

  const go = useCallback((delta: number) => {
    const el = scroller.current;
    if (!el || el.clientHeight === 0) return;
    const count = el.querySelectorAll("[data-reel]").length;
    const current = Math.round(el.scrollTop / el.clientHeight);
    const target = Math.min(Math.max(current + delta, 0), count - 1);
    el.scrollTo({ top: target * el.clientHeight, behavior: "smooth" });
  }, []);

  // Which post is on screen.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setIndex(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-reel]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [all.length]);

  useEffect(() => {
    setVideoSeconds(null);
  }, [index]);

  // Play the video on screen, pause the others, and time the post by it.
  useEffect(() => {
    scroller.current?.querySelectorAll<HTMLVideoElement>("video").forEach(async (video) => {
      const slide = video.closest<HTMLElement>("[data-reel]");
      if (slide?.dataset.index !== String(index)) {
        video.pause();
        return;
      }
      const readLength = () => {
        if (Number.isFinite(video.duration)) setVideoSeconds(Math.min(Math.ceil(video.duration), 120));
      };
      if (video.readyState >= 1) readLength();
      else video.addEventListener("loadedmetadata", readLength, { once: true });
      await video.play().catch(() => {});
    });
  }, [index, all.length]);

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || NO_INPUT.test(target.tagName))) return;
      if (document.body.style.overflow === "hidden") return;

      const next = event.key === "ArrowDown" || event.key === "PageDown" || event.key === "j";
      const prev = event.key === "ArrowUp" || event.key === "PageUp" || event.key === "k";
      if (!next && !prev) return;
      event.preventDefault();
      go(next ? 1 : -1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go]);

  // Fetch the next page when the reader gets close to the end.
  useEffect(() => {
    if (!cursor || loading.current || index < all.length - 3) return;
    loading.current = true;
    void loadMoreReels(param, cursor)
      .then((next) => {
        setExtra((current) => [...current, ...next.slides]);
        setCursor(next.nextCursor);
        setPages((n) => n + 1);
      })
      .catch(() => {})
      .finally(() => {
        loading.current = false;
      });
  }, [index, all.length, cursor, param]);

  // The server tree re-renders after likes and reposts; reload appended pages
  // so their buttons reflect the new state.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (pages === 0 || !initialCursor) return;
    void loadMoreReels(param, initialCursor, pages)
      .then((next) => {
        setExtra(next.slides);
        setCursor(next.nextCursor);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides]);

  const atEnd = index >= all.length - 1 && !cursor;
  const showBar = auto && active;

  return (
    <div
      className="relative h-[calc(100dvh-14rem)] bg-canvas md:h-[calc(100dvh-6.5rem)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {showBar && (
        <div
          className="absolute inset-x-0 top-0 z-10 h-1 bg-neutral-200"
          role="progressbar"
          aria-label="Time left on this post"
        >
          <div
            key={active.id}
            className="h-full bg-linc-600"
            style={{
              animation: `reelbar ${seconds}s linear forwards`,
              animationPlayState: paused || hidden ? "paused" : "running",
            }}
            onAnimationEnd={() => {
              if (!atEnd) go(1);
            }}
          />
        </div>
      )}

      <div
        ref={scroller}
        tabIndex={-1}
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain outline-none"
      >
        {all.map((slide, i) => (
          <section key={slide.id} data-reel data-index={i} className="h-full snap-start snap-always">
            {slide.node}
          </section>
        ))}
      </div>

      <div className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-2 md:flex">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="Previous post"
          title="Previous post (↑)"
          className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink shadow transition hover:bg-neutral-50 disabled:opacity-40"
        >
          <Arrow up />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={atEnd}
          aria-label="Next post"
          title="Next post (↓)"
          className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink shadow transition hover:bg-neutral-50 disabled:opacity-40"
        >
          <Arrow />
        </button>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={auto}
        onClick={toggleAuto}
        className="absolute bottom-3 right-3 z-10 flex items-center gap-2 rounded-full border border-line bg-white py-1.5 pl-3 pr-2 text-[12px] font-semibold text-ink shadow transition hover:bg-neutral-50"
      >
        Auto-scroll
        <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${auto ? "bg-linc-600" : "bg-neutral-300"}`}>
          <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${auto ? "translate-x-4" : ""}`} />
        </span>
      </button>

      <style>{`@keyframes reelbar{from{width:0}to{width:100%}}`}</style>
    </div>
  );
}

function Arrow({ up = false }: { up?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-5 w-5 ${up ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
