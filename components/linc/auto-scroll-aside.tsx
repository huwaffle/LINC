"use client";

import { useEffect, useRef, type ReactNode } from "react";

const SPEED_PX_PER_SEC = 18;
const EDGE_PAUSE_MS = 2500;

/** Right-hand panel that drifts downward slowly, stops while hovered/focused, and reverses direction at each end. */
export function AutoScrollAside({ children, pinned }: { children: ReactNode; pinned?: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const paused = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let last = performance.now();
    let position = el.scrollTop;
    let holdUntil = 0;
    let direction = 1;

    const tick = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      const max = el.scrollHeight - el.clientHeight;

      if (paused.current || max <= 0 || now < holdUntil) {
        position = el.scrollTop;
      } else {
        position += (direction * SPEED_PX_PER_SEC * dt) / 1000;
        if (position >= max || position <= 0) {
          position = Math.min(Math.max(position, 0), max);
          direction = -direction;
          holdUntil = now + EDGE_PAUSE_MS;
        }
        el.scrollTop = position;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const pause = () => {
    paused.current = true;
  };
  const resume = () => {
    paused.current = false;
  };

  return (
    <div className="sticky top-0 hidden h-screen w-[320px] shrink-0 flex-col pl-5 pt-6 lg:flex xl:col-start-3 xl:row-start-1 xl:justify-self-start">
      {pinned && <div className="shrink-0 pb-4">{pinned}</div>}
      <aside
        ref={ref}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onFocus={pause}
        onBlur={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto"
      >
        {children}
      </aside>
    </div>
  );
}
