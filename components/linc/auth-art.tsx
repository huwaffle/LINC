"use client";

import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

const COMPOSITIONS = [
  { label: "Orbit", ringTilt: 0, tileTilt: 12, tile: "bg-white/10", dot: "bg-white" },
  { label: "Drift", ringTilt: 45, tileTilt: -8, tile: "bg-linc-200/20", dot: "bg-linc-200" },
  { label: "Bloom", ringTilt: 90, tileTilt: 40, tile: "bg-linc-300/20", dot: "bg-linc-300" },
] as const;

function drift(x: number, y: number) {
  return `translate3d(calc(var(--px) * ${x}px), calc(var(--py) * ${y}px), 0)`;
}

export function AuthArt({
  title,
  caption,
  eyebrow,
}: {
  title: string;
  caption: string;
  eyebrow?: string;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [variant, setVariant] = useState(0);
  const current = COMPOSITIONS[variant];

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.style.setProperty("--px", (((event.clientX - rect.left) / rect.width) * 2 - 1).toFixed(3));
    canvas.style.setProperty("--py", (((event.clientY - rect.top) / rect.height) * 2 - 1).toFixed(3));
  }

  function onPointerLeave() {
    canvasRef.current?.style.setProperty("--px", "0");
    canvasRef.current?.style.setProperty("--py", "0");
  }

  return (
    <div
      ref={canvasRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{ "--px": 0, "--py": 0 } as CSSProperties}
      className="relative hidden h-full min-h-screen flex-col justify-between overflow-hidden bg-gradient-to-br from-linc-500 via-linc-600 to-linc-900 p-12 text-white lg:flex"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.16),transparent_55%)]"
      />

      {/* Minimal abstract canvas: shapes drift with the pointer and rearrange on click. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-20 top-[8%] h-[420px] w-[420px] transition-transform duration-200 ease-out will-change-transform"
          style={{ transform: drift(16, 12) }}
        >
          <div
            className="relative h-full w-full transition-transform duration-700 ease-out"
            style={{ transform: `rotate(${current.ringTilt}deg)` }}
          >
            <div className="absolute inset-0 rounded-full border border-white/15" />
            <div className="absolute inset-6 rounded-full border-t border-white/45" />
            <div className="absolute inset-24 rounded-full border-b border-white/25" />
          </div>
        </div>

        <div
          className="absolute right-[10%] top-[16%] h-44 w-44 transition-transform duration-200 ease-out will-change-transform"
          style={{ transform: drift(-22, -14) }}
        >
          <div
            className={`relative h-full w-full rounded-[3rem] backdrop-blur-sm transition-all duration-700 ease-out ${current.tile}`}
            style={{ transform: `rotate(${current.tileTilt}deg)` }}
          />
        </div>

        <div
          className="absolute bottom-[28%] left-[16%] h-3 w-3 transition-transform duration-200 ease-out will-change-transform"
          style={{ transform: drift(30, 22) }}
        >
          <div className={`h-full w-full rounded-full transition-colors duration-700 ${current.dot}`} />
        </div>

        <div
          className="absolute bottom-[22%] right-[12%] h-px w-52 origin-left transition-transform duration-200 ease-out will-change-transform"
          style={{ transform: drift(-12, 8) }}
        >
          <div
            className="h-full w-full bg-white/30 transition-transform duration-700 ease-out"
            style={{ transform: `rotate(${current.ringTilt / 2}deg)` }}
          />
        </div>
      </div>

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[34px] font-black tracking-[-0.04em] text-white">LINC</span>
          <span className="h-px w-10 bg-white/30" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
            Campus, connected
          </span>
        </div>

        <button
          type="button"
          onClick={() => setVariant((value) => (value + 1) % COMPOSITIONS.length)}
          aria-label={`Rearrange artwork, current pattern: ${current.label}`}
          className="group/button flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/85 backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="tabular-nums">
            {String(variant + 1).padStart(2, "0")} / {String(COMPOSITIONS.length).padStart(2, "0")}
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 transition-transform duration-500 group-hover/button:rotate-90 motion-reduce:transition-none"
            aria-hidden
          >
            <path d="M20 11a8 8 0 1 0-2.3 5.7" />
            <path d="M20 5v6h-6" />
          </svg>
        </button>
      </div>

      <div className="relative max-w-[430px]">
        {eyebrow && (
          <span className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none"
              aria-hidden
            />
            {eyebrow}
          </span>
        )}

        <h2 className="mt-4 text-[38px] font-black leading-[1.05] tracking-[-0.04em] text-white">
          {title}
        </h2>
        <p className="mt-3 max-w-[400px] text-[16px] leading-relaxed text-white/85">{caption}</p>
      </div>
    </div>
  );
}
