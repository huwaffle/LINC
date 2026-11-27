import Link from "next/link";
import { deleteEntry } from "@/app/actions/posts";
import { toggleSave } from "@/app/actions/social";
import type { EntryRecord } from "@/lib/db/queries";
import { BookmarkIcon, FlagIcon, MoreIcon, PencilIcon, TrashIcon } from "./icons";
import { ConfirmSubmit } from "./confirm-submit";
import { ReportButton } from "./report-dialog";

/**
 * Secondary post actions live behind a native disclosure menu so the main
 * action row stays limited to like, comment, repost and open post.
 */
export function PostMore({
  entry,
  viewerId,
  returnTo = "/",
  canManage = false,
  canEdit = canManage && !entry.is_anonymous,
}: {
  entry: EntryRecord;
  viewerId?: string | null;
  returnTo?: string;
  /** The author (or an admin) may edit and delete this post. */
  canManage?: boolean;
  /** The author (not for anonymous posts) or an admin may edit. */
  canEdit?: boolean;
}) {
  const saved = Boolean(entry.viewer_has_saved);
  const href = `/c/${entry.category_slug}/${entry.id}`;
  const loginHref = `/login?next=${encodeURIComponent(returnTo)}`;
  const editable = canEdit;

  return (
    <details className="group/more absolute right-3 top-2.5 z-20">
      <summary
        aria-label="More options"
        title="More options"
        className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-ink [&::-webkit-details-marker]:hidden"
      >
        <MoreIcon className="h-[18px] w-[18px]" />
      </summary>

      <div className="absolute right-0 top-full mt-1 w-52 overflow-hidden rounded-2xl border border-line bg-white py-1 shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
        {viewerId ? (
          <form action={toggleSave}>
            <input type="hidden" name="entryId" value={entry.id} />
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-ink transition hover:bg-neutral-50"
            >
              <BookmarkIcon
                filled={saved}
                className={`h-[18px] w-[18px] ${saved ? "text-ink" : "text-neutral-500"}`}
              />
              {saved ? "Remove from saved" : "Save post"}
            </button>
          </form>
        ) : (
          <Link
            href={loginHref}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-ink transition hover:bg-neutral-50"
          >
            <BookmarkIcon className="h-[18px] w-[18px] text-neutral-500" />
            Save post
          </Link>
        )}

        {entry.status === "published" && (
          viewerId ? (
            <ReportButton
              entryId={entry.id}
              slug={entry.category_slug}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-rose-600 transition hover:bg-rose-50"
            >
              <FlagIcon className="h-[17px] w-[17px]" />
              Report post
            </ReportButton>
          ) : (
            <Link
              href={loginHref}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-rose-600 transition hover:bg-rose-50"
            >
              <FlagIcon className="h-[17px] w-[17px]" />
              Report post
            </Link>
          )
        )}

        {editable && (
          <div className="mt-1 border-t border-line pt-1">
            <Link
              href={`${href}/edit`}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-ink transition hover:bg-neutral-50"
            >
              <PencilIcon className="h-[17px] w-[17px] text-neutral-500" />
              Edit post
            </Link>
            <form action={deleteEntry}>
              <input type="hidden" name="entryId" value={entry.id} />
              <ConfirmSubmit
                message="Delete this post and its comments? This cannot be undone."
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-rose-600 transition hover:bg-rose-50"
              >
                <TrashIcon className="h-[17px] w-[17px]" />
                Delete post
              </ConfirmSubmit>
            </form>
          </div>
        )}
      </div>
    </details>
  );
}
