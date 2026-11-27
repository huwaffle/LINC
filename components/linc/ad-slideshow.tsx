"use client";

import { useEffect, useRef, useState } from "react";

export type SlideAd = {
  id: string;
  title: string;
  body: string;
  sponsor: string;
  hasImage: boolean;
};

const INTERVAL_MS = 5000;

/** Rotating sponsored card. Pauses on hover/focus; each slide counts a view once when first shown. */
export function AdSlideshow({ ads }: { ads: SlideAd[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const seen = useRef(new Set<string>());
  const current = ads[index % ads.length];

  useEffect(() => {
    if (!current || seen.current.has(current.id)) return;
    seen.current.add(current.id);
    void fetch(`/api/ads/${current.id}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [current]);

  useEffect(() => {
    if (paused || ads.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % ads.length), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, ads.length]);

  if (!current) return null;

  return (
    <aside
      aria-label="Advertisements"
      aria-roledescription="carousel"
      className="overflow-hidden rounded-2xl border border-line bg-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <a
        key={current.id}
        href={`/api/ads/${current.id}/click`}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className="block h-[272px] animate-[fadeIn_0.4s_ease] overflow-hidden transition hover:bg-neutral-50/70"
      >
        {current.hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/ads/${current.id}/image`} alt="" className="h-36 w-full object-cover" />
        ) : (
          <span aria-hidden className="block h-36 w-full bg-gradient-to-br from-linc-50 to-neutral-100" />
        )}
        <span className="block h-[128px] overflow-hidden px-4 py-3">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
            <span className="rounded bg-neutral-100 px-1.5 py-0.5">Sponsored</span>
            <span className="truncate normal-case tracking-normal">{current.sponsor}</span>
          </span>
          <span className="mt-1 line-clamp-2 block text-[14px] font-semibold text-ink">{current.title}</span>
          {current.body && (
            <span className="mt-0.5 line-clamp-2 block text-[13px] leading-relaxed text-neutral-500">
              {current.body}
            </span>
          )}
        </span>
      </a>

      {ads.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-3" role="tablist" aria-label="Choose advertisement">
          {ads.map((ad, i) => (
            <button
              key={ad.id}
              type="button"
              role="tab"
              aria-selected={i === index % ads.length}
              aria-label={`Show advertisement ${i + 1} of ${ads.length}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index % ads.length ? "w-5 bg-linc-600" : "w-1.5 bg-neutral-300 hover:bg-neutral-400"
              }`}
            />
          ))}
        </div>
      )}

      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){a[class*="fadeIn"]{animation:none}}`}</style>
    </aside>
  );
}
