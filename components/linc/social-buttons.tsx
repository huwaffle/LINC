import Link from "next/link";
import { toggleCommentLike, toggleLike, toggleRepost } from "@/app/actions/social";
import type { CommentRecord, EntryRecord } from "@/lib/db/queries";
import { HeartIcon, RepostIcon } from "./icons";

const base =
  "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] transition";

export function LikeButton({
  entry,
  viewerId,
  returnTo = "/",
}: {
  entry: EntryRecord;
  viewerId?: string | null;
  returnTo?: string;
}) {
  const liked = Boolean(entry.viewer_has_liked);
  const count = entry.like_count ?? 0;
  const label = liked ? "Unlike post" : "Like post";

  const content = (
    <>
      <HeartIcon
        filled={liked}
        className={`h-[18px] w-[18px] ${liked ? "text-rose-500" : ""}`}
      />
      {count > 0 && <span className={liked ? "text-rose-500" : ""}>{count}</span>}
    </>
  );

  if (!viewerId) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(returnTo)}`}
        aria-label="Sign in to like posts"
        title="Sign in to like posts"
        className={`${base} text-neutral-500 hover:bg-neutral-100 hover:text-rose-500`}
      >
        {content}
      </Link>
    );
  }

  return (
    <form action={toggleLike}>
      <input type="hidden" name="entryId" value={entry.id} />
      <button
        type="submit"
        aria-label={label}
        title={label}
        aria-pressed={liked}
        className={`${base} ${
          liked
            ? "text-rose-500 hover:bg-rose-50"
            : "text-neutral-500 hover:bg-neutral-100 hover:text-rose-500"
        }`}
      >
        {content}
      </button>
    </form>
  );
}

export function RepostButton({
  entry,
  viewerId,
  returnTo = "/",
}: {
  entry: EntryRecord;
  viewerId?: string | null;
  returnTo?: string;
}) {
  const reposted = Boolean(entry.viewer_has_reposted);
  const count = entry.repost_count ?? 0;
  const label = reposted ? "Undo repost" : "Repost post";

  const content = (
    <>
      <RepostIcon className="h-[18px] w-[18px]" />
      {count > 0 && <span className={reposted ? "text-ink" : ""}>{count}</span>}
    </>
  );

  if (!viewerId) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(returnTo)}`}
        aria-label="Sign in to repost posts"
        title="Sign in to repost posts"
        className={`${base} text-neutral-500 hover:bg-neutral-100 hover:text-ink`}
      >
        {content}
      </Link>
    );
  }

  return (
    <form action={toggleRepost}>
      <input type="hidden" name="entryId" value={entry.id} />
      <button
        type="submit"
        aria-label={label}
        title={label}
        aria-pressed={reposted}
        className={`${base} ${
          reposted
            ? "font-semibold text-ink hover:bg-neutral-100"
            : "text-neutral-500 hover:bg-neutral-100 hover:text-ink"
        }`}
      >
        {content}
      </button>
    </form>
  );
}

export function CommentLikeButton({
  comment,
  entryId,
  viewerId,
  returnTo = "/",
}: {
  comment: CommentRecord;
  entryId: string;
  viewerId?: string | null;
  returnTo?: string;
}) {
  const liked = Boolean(comment.viewer_has_liked);
  const count = comment.like_count ?? 0;
  const label = liked ? "Unlike comment" : "Like comment";

  const content = (
    <>
      <HeartIcon
        filled={liked}
        className={`h-4 w-4 ${liked ? "text-rose-500" : ""}`}
      />
      {count > 0 && <span className={liked ? "text-rose-500" : ""}>{count}</span>}
    </>
  );

  if (!viewerId) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(returnTo)}`}
        aria-label="Sign in to like comments"
        title="Sign in to like comments"
        className={`${base} h-7 px-2 text-[12px] text-neutral-500 hover:bg-neutral-100 hover:text-rose-500`}
      >
        {content}
      </Link>
    );
  }

  return (
    <form action={toggleCommentLike}>
      <input type="hidden" name="commentId" value={comment.id} />
      <input type="hidden" name="entryId" value={entryId} />
      <button
        type="submit"
        aria-label={label}
        title={label}
        aria-pressed={liked}
        className={`${base} h-7 px-2 text-[12px] ${
          liked
            ? "text-rose-500 hover:bg-rose-50"
            : "text-neutral-500 hover:bg-neutral-100 hover:text-rose-500"
        }`}
      >
        {content}
      </button>
    </form>
  );
}
