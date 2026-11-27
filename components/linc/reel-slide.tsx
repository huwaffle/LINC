import Link from "next/link";
import type { ReactNode } from "react";
import { FEED_AD_EVERY } from "./ad-card";
import { Avatar } from "./avatar";
import { CategoryChip } from "./category-chip";
import { ArrowUpRightIcon, CommentIcon } from "./icons";
import { PostMore } from "./post-more";
import { LikeButton, RepostButton } from "./social-buttons";
import { isPreviewable, isVideo } from "@/lib/attachments";
import { avatarSrc } from "@/lib/avatars";
import { pickAd, recordImpression, type AdRecord } from "@/lib/db/ads";
import type { EntryRecord } from "@/lib/db/queries";
import { formatRelative } from "@/lib/format";
import { reelSeconds } from "@/lib/reel-time";

const AD_SECONDS = 8;

export type ReelSlideData = { id: string; seconds: number; node: ReactNode };

const actionClass =
  "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900";

/** One post filling one screen. Nothing inside scrolls; long text is clamped and media shrinks to fit. */
function ReelSlide({
  entry,
  viewerId,
  returnTo,
}: {
  entry: EntryRecord;
  viewerId?: string | null;
  returnTo: string;
}) {
  const href = `/c/${entry.category_slug}/${entry.id}`;
  const author = entry.is_anonymous ? "Anonymous Lasallian" : entry.author_name;
  const authorHref = entry.is_anonymous ? null : `/u/${entry.author_username}`;
  const media = (entry.media ?? []).filter((file) => isPreviewable(file.mime_type));
  const lead = media[0];

  const avatar = (
    <Avatar
      name={author}
      anonymous={Boolean(entry.is_anonymous)}
      src={avatarSrc(entry.author_id, entry.author_has_avatar)}
      size={40}
    />
  );

  return (
    <article className="relative h-full overflow-hidden bg-white px-5 md:px-8 md:pr-16">
      <PostMore
        entry={entry}
        viewerId={viewerId}
        returnTo={returnTo}
        canManage={Boolean(viewerId && viewerId === entry.author_id)}
      />

      <div className="mx-auto flex h-full min-h-0 w-full max-w-xl flex-col justify-center py-14">
        <div className="flex shrink-0 items-center gap-3 pr-8">
          {authorHref ? (
            <Link href={authorHref} aria-label={`View ${author}'s profile`} className="rounded-full">
              {avatar}
            </Link>
          ) : (
            avatar
          )}
          <div className="min-w-0 text-[13px] leading-tight">
            <p className="truncate font-semibold text-ink">{author}</p>
            <p className="text-neutral-500">{formatRelative(entry.created_at)}</p>
          </div>
        </div>

        <CategoryChip
          slug={entry.category_slug}
          label={entry.category_label}
          href={`/c/${entry.category_slug}`}
          className="mt-3 inline-block w-fit shrink-0 text-[12px]"
        />

        <h2 className="mt-2 line-clamp-3 shrink-0 text-[22px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">
          {entry.title}
        </h2>

        <div
          className={`mt-3 min-h-0 overflow-hidden text-[16px] leading-[1.55] text-neutral-800 ${
            lead ? "line-clamp-4 shrink-0" : "line-clamp-[8] md:line-clamp-[16]"
          }`}
        >
          <p className="whitespace-pre-line">{entry.body}</p>
        </div>

        {lead && (
          <div className="relative mt-3 min-h-[120px] max-h-[420px] flex-1">
            {isVideo(lead.mime_type) ? (
              <video
                controls
                muted
                loop
                playsInline
                preload="metadata"
                aria-label={lead.filename}
                className="h-full w-full rounded-2xl bg-black object-contain"
              >
                <source src={`/api/files/${lead.id}`} type={lead.mime_type} />
              </video>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/files/${lead.id}`}
                alt={lead.filename}
                className="h-full w-full rounded-2xl border border-line bg-canvas object-contain"
              />
            )}
            {media.length > 1 && (
              <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                +{media.length - 1}
              </span>
            )}
          </div>
        )}

        <div className="mt-3 -ml-2.5 flex shrink-0 items-center gap-0.5">
          <LikeButton entry={entry} viewerId={viewerId} returnTo={returnTo} />
          <Link href={`${href}#discussion`} aria-label="View replies" title="View replies" className={actionClass}>
            <CommentIcon className="h-[18px] w-[18px]" />
            <span>{entry.comment_count}</span>
          </Link>
          <RepostButton entry={entry} viewerId={viewerId} returnTo={returnTo} />
          <Link href={href} aria-label="Open full post" title="Open full post" className={actionClass}>
            <ArrowUpRightIcon className="h-[18px] w-[18px]" />
            <span>Full post</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

/** A sponsored post that fills one reel screen, labelled the same way as ads in the list feed. */
async function ReelAdSlide({ ad }: { ad: AdRecord }) {
  await recordImpression(ad.id);

  return (
    <aside aria-label="Advertisement" className="h-full overflow-hidden bg-neutral-50/60 px-5 md:px-8 md:pr-16">
      <a
        href={`/api/ads/${ad.id}/click`}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className="mx-auto flex h-full min-h-0 w-full max-w-xl flex-col justify-center py-14"
      >
        {ad.image_path && (
          <div className="min-h-[120px] max-h-[420px] flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/ads/${ad.id}/image`}
              alt=""
              className="h-full w-full rounded-2xl border border-line bg-white object-contain"
            />
          </div>
        )}
        <span className="mt-4 flex shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
          <span className="rounded bg-neutral-100 px-1.5 py-0.5">Sponsored</span>
          <span className="truncate normal-case tracking-normal">{ad.sponsor}</span>
        </span>
        <span className="mt-1 line-clamp-3 shrink-0 text-[22px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">
          {ad.title}
        </span>
        {ad.body && (
          <span className="mt-2 line-clamp-4 shrink-0 text-[16px] leading-[1.55] text-neutral-600">{ad.body}</span>
        )}
      </a>
    </aside>
  );
}

export async function reelSlides(
  entries: EntryRecord[],
  viewerId: string | null | undefined,
  returnTo: string,
): Promise<ReelSlideData[]> {
  const groups = await Promise.all(entries.map(async (entry, index) => {
    const slides: ReelSlideData[] = [
      {
        id: entry.id,
        seconds: reelSeconds(entry),
        node: <ReelSlide entry={entry} viewerId={viewerId} returnTo={returnTo} />,
      },
    ];
    const ad = (index + 1) % FEED_AD_EVERY === 0 ? await pickAd() : null;
    if (ad) slides.push({ id: `ad-${entry.id}`, seconds: AD_SECONDS, node: <ReelAdSlide ad={ad} /> });
    return slides;
  }));
  return groups.flat();
}
