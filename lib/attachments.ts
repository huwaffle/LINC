export type AttachmentFile = {
  id: string;
  filename: string;
  mime_type: string;
  byte_size: number;
};

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function isVideo(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

/** Images, GIFs and videos can be shown inline; PDFs stay a compact file link. */
export function isPreviewable(mimeType: string): boolean {
  return isImage(mimeType) || isVideo(mimeType);
}
