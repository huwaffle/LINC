"use client";

import { useState } from "react";
import { isImage, isPreviewable, isVideo, type AttachmentFile } from "@/lib/attachments";
import { ExpandIcon, PaperclipIcon, PlayIcon } from "./icons";
import { MediaViewer } from "./media-viewer";

export type { AttachmentFile };

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function Caption({ file }: { file: AttachmentFile }) {
  return (
    <figcaption className="flex items-center justify-between gap-3 border-t border-line bg-white px-3 py-1.5 text-[11px] text-neutral-500">
      <span className="truncate">{file.filename}</span>
      <span className="shrink-0 text-neutral-400">{formatSize(file.byte_size)}</span>
    </figcaption>
  );
}

/**
 * Renders uploaded media directly in the page. Images and videos are never
 * reduced to a download link; PDFs keep a compact file link because browsers
 * handle them differently. Clicking a picture or video opens a full-screen
 * viewer where images can be zoomed and panned.
 */
export function AttachmentPreview({ file }: { file: AttachmentFile }) {
  const [open, setOpen] = useState(false);
  const src = `/api/files/${file.id}`;

  if (isImage(file.mime_type)) {
    return (
      <figure className="overflow-hidden rounded-xl border border-line bg-canvas">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open ${file.filename} full screen`}
          className="group relative block w-full cursor-zoom-in"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={file.filename}
            loading="lazy"
            className="max-h-[460px] w-full object-contain"
          />
          <span className="pointer-events-none absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition group-hover:bg-black/80">
            <ExpandIcon className="h-4 w-4" />
          </span>
        </button>
        <Caption file={file} />
        {open && <MediaViewer file={file} onClose={() => setOpen(false)} />}
      </figure>
    );
  }

  if (isVideo(file.mime_type)) {
    return (
      <figure className="relative overflow-hidden rounded-xl border border-line bg-black">
        <video
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          className="pointer-events-none max-h-[460px] w-full"
        >
          <source src={src} type={file.mime_type} />
        </video>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open ${file.filename} full screen`}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition hover:bg-black/35"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-ink shadow-lg">
            <PlayIcon className="ml-0.5 h-6 w-6" />
          </span>
          <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur">
            <ExpandIcon className="h-4 w-4" />
          </span>
        </button>
        <Caption file={file} />
        {open && <MediaViewer file={file} onClose={() => setOpen(false)} />}
      </figure>
    );
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[13px] font-medium text-linc-700 transition hover:bg-linc-50"
    >
      <PaperclipIcon className="h-4 w-4 shrink-0" />
      <span className="truncate">{file.filename}</span>
      <span className="shrink-0 text-neutral-400">{formatSize(file.byte_size)}</span>
    </a>
  );
}

/**
 * Feed-sized version of the preview. It uses one fixed aspect ratio so every
 * card in the feed has the same media height, whichever photo was uploaded.
 * Feed cards stay inline; the full-screen viewer belongs to post detail.
 */
export function AttachmentThumb({
  file,
  extra = 0,
}: {
  file: AttachmentFile;
  extra?: number;
}) {
  if (!isPreviewable(file.mime_type)) return null;

  const src = `/api/files/${file.id}`;

  return (
    <div className="relative mt-2 overflow-hidden rounded-2xl border border-line bg-canvas">
      {isVideo(file.mime_type) ? (
        <video
          controls
          playsInline
          muted
          preload="metadata"
          aria-label={file.filename}
          className="aspect-[16/10] w-full bg-black object-cover"
        >
          <source src={src} type={file.mime_type} />
        </video>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={file.filename}
          loading="lazy"
          className="aspect-[16/10] w-full object-cover"
        />
      )}
      {extra > 0 && (
        <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
          +{extra}
        </span>
      )}
    </div>
  );
}
