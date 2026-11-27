"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isImage, isVideo, type AttachmentFile } from "@/lib/attachments";
import { ExpandIcon, MinusIcon, PlusIcon, XIcon } from "./icons";
import { useFocusTrap } from "./use-focus-trap";

const MIN_SCALE = 1;
const MAX_SCALE = 5;

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value.toFixed(2))));
}

/**
 * Full-screen media surface used from a post's inline attachment. Images can
 * be zoomed, panned, and reset; videos play in the same full-screen shell.
 */
export function MediaViewer({
  file,
  onClose,
}: {
  file: AttachmentFile;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  useFocusTrap(dialogRef);

  const image = isImage(file.mime_type);
  const video = isVideo(file.mime_type);
  const src = `/api/files/${file.id}`;

  const zoomTo = useCallback((next: number) => {
    const clamped = clampScale(next);
    setScale(clamped);
    if (clamped === MIN_SCALE) setOffset({ x: 0, y: 0 });
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (!image) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomTo(scale + 0.5);
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomTo(scale - 0.5);
      }
      if (event.key === "0") {
        event.preventDefault();
        resetZoom();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [image, onClose, resetZoom, scale, zoomTo]);

  function onPointerDown(event: React.PointerEvent<HTMLImageElement>) {
    if (scale <= MIN_SCALE) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: offset.x,
      baseY: offset.y,
    };
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLImageElement>) {
    const current = drag.current;
    if (!current) return;
    setOffset({
      x: current.baseX + event.clientX - current.startX,
      y: current.baseY + event.clientY - current.startY,
    });
  }

  function onPointerUp(event: React.PointerEvent<HTMLImageElement>) {
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing ${file.filename}`}
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white"
    >
      <header
        className="flex h-14 shrink-0 items-center justify-between gap-3 px-3 sm:px-4"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="min-w-0 truncate text-[13px] font-medium text-white/80">{file.filename}</p>
        <div className="flex shrink-0 items-center gap-1">
          {image && (
            <>
              <button
                type="button"
                onClick={() => zoomTo(scale - 0.5)}
                disabled={scale <= MIN_SCALE}
                aria-label="Zoom out"
                className="grid h-9 w-9 place-items-center rounded-full text-white/90 transition hover:bg-white/10 disabled:opacity-35"
              >
                <MinusIcon className="h-5 w-5" />
              </button>
              <span
                className="min-w-[44px] text-center text-[12px] font-semibold tabular-nums text-white/70"
                aria-live="polite"
              >
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => zoomTo(scale + 0.5)}
                disabled={scale >= MAX_SCALE}
                aria-label="Zoom in"
                className="grid h-9 w-9 place-items-center rounded-full text-white/90 transition hover:bg-white/10 disabled:opacity-35"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={resetZoom}
                aria-label="Reset zoom"
                disabled={scale === MIN_SCALE && offset.x === 0 && offset.y === 0}
                className="ml-1 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-35"
              >
                Reset
              </button>
            </>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close viewer"
            className="ml-1 grid h-9 w-9 place-items-center rounded-full text-white/90 transition hover:bg-white/10"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-6"
        onClick={() => {
          if (image) onClose();
        }}
      >
        {image && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src}
            alt={file.filename}
            draggable={false}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={() => (scale > MIN_SCALE ? resetZoom() : zoomTo(2))}
            onWheel={(event) => {
              event.stopPropagation();
              zoomTo(scale + (event.deltaY < 0 ? 0.25 : -0.25));
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="max-h-full max-w-full touch-none object-contain select-none"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: dragging ? "none" : "transform 120ms ease-out",
              cursor: scale > MIN_SCALE ? (dragging ? "grabbing" : "grab") : "zoom-in",
            }}
          />
        )}

        {video && (
          <video
            src={src}
            controls
            autoPlay
            playsInline
            aria-label={file.filename}
            onClick={(event) => event.stopPropagation()}
            className="max-h-full max-w-full bg-black"
          >
            <source src={src} type={file.mime_type} />
          </video>
        )}

        {!image && !video && (
          <p className="rounded-xl bg-white/10 px-4 py-3 text-[14px] text-white/80">
            This file cannot be previewed. Close the viewer and open the attachment link.
          </p>
        )}
      </div>

      <footer className="flex h-9 shrink-0 items-center justify-center px-4 text-[11px] text-white/45">
        {image
          ? "Use the controls or scroll to zoom · drag to pan · double-click to reset"
          : "Press Esc or the close button to return to the post"}
      </footer>
    </div>,
    document.body,
  );
}
