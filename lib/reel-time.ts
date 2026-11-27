import { isImage, isVideo } from "@/lib/attachments";

const WORDS_PER_SECOND = 3;
const BASE_SECONDS = 5;
const IMAGE_SECONDS = 4;
const VIDEO_SECONDS = 10;
const MIN_SECONDS = 8;
const MAX_SECONDS = 90;

/**
 * How long a post is shown in the reel feed. It grows with the amount of text
 * and with each picture; a video adds a base amount that the viewer extends
 * to the video's real length once the browser knows it.
 */
export function reelSeconds(entry: {
  title: string;
  body: string;
  media?: { mime_type: string }[];
}): number {
  const words = `${entry.title} ${entry.body}`.split(/\s+/).filter(Boolean).length;
  const media = entry.media ?? [];
  const images = media.filter((file) => isImage(file.mime_type)).length;
  const hasVideo = media.some((file) => isVideo(file.mime_type));

  const seconds =
    BASE_SECONDS + words / WORDS_PER_SECOND + images * IMAGE_SECONDS + (hasVideo ? VIDEO_SECONDS : 0);
  return Math.round(Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, seconds)));
}
