import Link from "next/link";
import { CategoryChip } from "./category-chip";
import { AttachmentThumb } from "./attachment-preview";
import { CommentIcon, ArrowUpRightIcon } from "./icons";
import { Avatar } from "./avatar";
import { Highlight } from "./highlight";
import { PostMore } from "./post-more";
import { StatusBadge } from "./status-badge";
import { LikeButton, RepostButton } from "./social-buttons";
import { isPreviewable } from "@/lib/attachments";
import { avatarSrc } from "@/lib/avatars";
import { excerpt, formatRelative } from "@/lib/format";
import type { EntryRecord } from "@/lib/db/queries";

function Action({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
    >
      {children}
    </Link>
  );
}

export function PostCard({
  entry,
  showStatus = false,
  connector = false,
  viewerId,
  returnTo = "/",
  highlight,
}: {
  entry: EntryRecord;
  highlight?: string[];
  showStatus?: boolean;
  connector?: boolean;
  viewerId?: string | null;
  returnTo?: string;
}) {
  const href = `/c/${entry.category_slug}/${entry.id}`;
  const author = entry.is_anonymous ? "Anonymous Lasallian" : entry.author_name;
  const authorHref = entry.is_anonymous ? null : `/u/${entry.author_username}`;
  const authorAvatar = avatarSrc(entry.author_id, entry.author_has_avatar);

  const media = (entry.media ?? []).filter((file) => isPreviewable(file.mime_type));
  const lead = media[0];
  const extra = lead ? media.length - 1 : 0;

  return (
    <article className="group relative flex gap-3 px-4 py-3.5 transition hover:bg-neutral-50/60">
      <PostMore
        entry={entry}
        viewerId={viewerId}
        returnTo={returnTo}
        canManage={Boolean(viewerId && viewerId === entry.author_id)}
      />

      <div className="flex flex-col items-center">
        {authorHref ? (
          <Link href={authorHref} aria-label={`View ${author}'s profile`} className="rounded-full">
            <Avatar
              name={author}
              anonymous={Boolean(entry.is_anonymous)}
              src={authorAvatar}
              size={36}
            />
          </Link>
        ) : (
          <Avatar
            name={author}
            anonymous={Boolean(entry.is_anonymous)}
            src={authorAvatar}
            size={36}
          />
        )}
        {connector && <span className="mt-1 w-px flex-1 bg-line" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pr-8 text-[13px] leading-none">
          {authorHref ? (
            <Link
              href={authorHref}
              className="font-semibold text-ink transition hover:underline"
            >
              {author}
            </Link>
          ) : (
            <span className="font-semibold text-ink">{author}</span>
          )}
          <span className="text-neutral-300">·</span>
          <span className="text-neutral-500">{formatRelative(entry.created_at)}</span>
          {showStatus && (
            <>
              <span className="text-neutral-300">·</span>
              <StatusBadge status={entry.status} />
            </>
          )}
        </div>

        <Link href={href} className="mt-1 block">
          <h2 className="text-[15px] font-semibold leading-[1.35] tracking-[-0.01em] text-ink">
            <Highlight text={entry.title} terms={highlight} />
          </h2>
          {lead ? (
            <p className="mt-1 text-[15px] leading-[1.45] text-neutral-800">
              <Highlight text={excerpt(entry.body, 140)} terms={highlight} />
            </p>
          ) : (
            <p className="mt-1 text-[15px] leading-[1.45] text-neutral-800">
              <Highlight text={excerpt(entry.body, 220)} terms={highlight} />
            </p>
          )}
          {lead && <AttachmentThumb file={lead} extra={extra} />}
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-neutral-500">
          <CategoryChip
            slug={entry.category_slug}
            label={entry.category_label}
            href={`/c/${entry.category_slug}`}
          />
          {entry.status === "rejected" && entry.reject_reason && (
            <>
              <span className="text-neutral-300">·</span>
              <span className="text-rose-600">{entry.reject_reason}</span>
            </>
          )}
          {entry.status === "redacted" && entry.reject_reason && (
            <>
              <span className="text-neutral-300">·</span>
              <span className="text-rose-600">Will be deleted due to: {entry.reject_reason}</span>
            </>
          )}
        </div>

        <div className="mt-1.5 -ml-2.5 flex items-center gap-0.5">
          <LikeButton entry={entry} viewerId={viewerId} returnTo={returnTo} />
          <Action href={`${href}#discussion`} label="View replies">
            <CommentIcon className="h-[18px] w-[18px]" />
            <span>{entry.comment_count}</span>
          </Action>
          <RepostButton entry={entry} viewerId={viewerId} returnTo={returnTo} />
          <Action href={href} label="Open post">
            <ArrowUpRightIcon className="h-[18px] w-[18px]" />
          </Action>
        </div>
      </div>
    </article>
  );
}
