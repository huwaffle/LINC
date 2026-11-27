export const dynamic = "force-dynamic";

import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AttachmentPreview } from "@/components/linc/attachment-preview";
import { AutoRefresh } from "@/components/linc/auto-refresh";
import { Avatar } from "@/components/linc/avatar";
import { Notice } from "@/components/linc/empty-state";
import { PageHeader } from "@/components/linc/page-header";
import { PostMore } from "@/components/linc/post-more";
import { CommentLikeButton, LikeButton, RepostButton } from "@/components/linc/social-buttons";
import { StatusBadge } from "@/components/linc/status-badge";
import { CommentIcon, PencilIcon } from "@/components/linc/icons";
import { ConfirmSubmit } from "@/components/linc/confirm-submit";
import { addComment, editComment } from "@/app/actions/social";
import { ReportButton } from "@/components/linc/report-dialog";
import { CopyButton } from "@/components/linc/copy-button";
import { ensureTrackingCode } from "@/lib/tracking";
import { CategoryChip } from "@/components/linc/category-chip";
import { CommentBody } from "@/components/linc/comment-body";
import { HashOpener } from "@/components/linc/hash-opener";
import { deleteComment } from "@/app/actions/posts";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/authz";
import {
  attachViewerState,
  getAccountById,
  getEntry,
  listAttachments,
  listComments,
  listModerationLog,
  resolveMentions,
  type CommentRecord,
} from "@/lib/db/queries";
import { avatarSrc } from "@/lib/avatars";
import { formatDateTime, formatRelative } from "@/lib/format";
import { messageFrom } from "@/lib/redirects";
import { recordView } from "@/lib/recommend/db";

export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; id: string }>;
  searchParams: Promise<{ notice?: string; error?: string; sort?: string }>;
}) {
  const { category, id } = await params;
  const sp = await searchParams;
  const session = await getSession();
  const entry = await getEntry(id);
  const account = session ? await getAccountById(session.id) : undefined;

  if (!entry || entry.category_slug !== category) notFound();

  const policy = can(session);
  if (
    entry.status !== "published" &&
    !policy.viewUnpublished({ status: entry.status }) &&
    !policy.viewOwnDraft({
      authorId: entry.author_id,
      isAnonymous: Boolean(entry.is_anonymous),
    })
  ) {
    notFound();
  }

  if (session && entry.status === "published") await recordView(session.id, "entry", entry.id);
  await attachViewerState([entry], session?.id);

  const comments = await listComments(entry.id, session?.id);
  const sort: CommentSort = COMMENT_SORTS.some((option) => option.value === sp.sort)
    ? (sp.sort as CommentSort)
    : "oldest";
  const childrenByParent = groupComments(comments, sort);
  const mentions = await resolveMentions(comments.map((comment) => comment.body));
  const base = `/c/${entry.category_slug}/${entry.id}`;
  const attachments = await listAttachments(entry.id);
  const timeline = policy.adminOnly() ? await listModerationLog(entry.id) : [];
  const message = messageFrom({
    error: typeof sp.error === "string" ? sp.error : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });
  const paragraphs = entry.body.split(/\n{2,}/).filter(Boolean);
  const author = entry.is_anonymous ? "Anonymous Lasallian" : entry.author_name;
  const authorHref = entry.is_anonymous ? null : `/u/${entry.author_username}`;
  const authorAvatar = avatarSrc(entry.author_id, entry.author_has_avatar);
  const myName = account?.display_name ?? session?.displayName ?? "";
  const myAvatar = avatarSrc(session?.id ?? "", Boolean(account?.avatar_path));
  const canEdit = Boolean(session && entry.author_id === session.id && !entry.is_anonymous);
  const trackingCode = canEdit || session?.role === "admin" ? await ensureTrackingCode(entry.id) : null;
  const canDelete = Boolean(session && (session.role === "admin" || canEdit));
  const canEditPost = canEdit || (session?.role === "admin" && entry.status !== "draft");

  const renderComments = (parentId: string | null, depth: number): ReactNode =>
    (childrenByParent.get(parentId) ?? []).map((comment) => {
      const name = comment.is_anonymous ? "Anonymous Lasallian" : comment.author_name;
      const commentHref = comment.is_anonymous ? null : `/u/${comment.author_username}`;
      const replyCount = countReplies(childrenByParent, comment.id);
      const replyNodes = renderComments(comment.id, depth + 1);
      const replies =
        replyCount > COLLAPSE_AFTER ? (
          <details className="group">
            <summary className="cursor-pointer list-none px-4 py-2 pl-[3.25rem] text-[12px] font-semibold text-linc-700 hover:underline [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Show {replyCount} replies</span>
              <span className="hidden group-open:inline">Hide replies</span>
            </summary>
            {replyNodes}
          </details>
        ) : (
          replyNodes
        );
      const indent = depth > 0 && depth < 3 ? "ml-9 border-l border-line" : "";

      return (
        <div key={comment.id} className={indent || undefined}>
          <article id={`comment-${comment.id}`} className="flex gap-3 px-4 py-3.5">
            {commentHref ? (
              <Link
                href={commentHref}
                aria-label={`View ${name}'s profile`}
                className="self-start rounded-full"
              >
                <Avatar
                  name={name}
                  anonymous={Boolean(comment.is_anonymous)}
                  src={avatarSrc(comment.author_id, comment.author_has_avatar)}
                  size={34}
                />
              </Link>
            ) : (
              <Avatar
                name={name}
                anonymous={Boolean(comment.is_anonymous)}
                src={avatarSrc(comment.author_id, comment.author_has_avatar)}
                size={34}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5">
                {commentHref ? (
                  <Link
                    href={commentHref}
                    className="text-[14px] font-semibold text-ink transition hover:underline"
                  >
                    {name}
                  </Link>
                ) : (
                  <span className="text-[14px] font-semibold text-ink">{name}</span>
                )}
                <span className="text-[12px] text-neutral-400">
                  {formatRelative(comment.created_at)}
                </span>
                {comment.edited_at && (
                  <span
                    className="text-[12px] text-neutral-400"
                    title={`Edited ${formatDateTime(comment.edited_at)}`}
                  >
                    · edited
                  </span>
                )}
              </div>
              <p className="mt-0.5 whitespace-pre-line text-[15px] leading-[1.45] text-neutral-800">
                <CommentBody body={comment.body} mentions={mentions} />
              </p>

              <div className="mt-1 -ml-2 flex flex-wrap items-center gap-2">
                <CommentLikeButton
                  comment={comment}
                  entryId={entry.id}
                  viewerId={session?.id}
                  returnTo={`/c/${entry.category_slug}/${entry.id}`}
                />
                {session && (
                  <details className="min-w-0">
                    <summary className="cursor-pointer list-none rounded-full px-2 py-1 text-[12px] font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-ink">
                      Reply
                    </summary>
                    <form action={addComment} className="mt-2 space-y-2">
                      <input type="hidden" name="entryId" value={entry.id} />
                      <input type="hidden" name="slug" value={entry.category_slug} />
                      <input type="hidden" name="parentId" value={comment.id} />
                      <textarea
                        name="body"
                        rows={2}
                        required
                        placeholder={`Reply to ${name}… Use @nickname to mention someone`}
                        className="w-full resize-none rounded-xl border border-line px-3 py-2 text-[14px] text-ink placeholder:text-neutral-400 outline-none transition focus:border-linc-400 focus:ring-4 focus:ring-linc-50"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {session.role !== "admin" ? (
                        <label className="flex items-center gap-1.5 text-[12px] text-neutral-500">
                          <input
                            type="checkbox"
                            name="isAnonymous"
                            className="h-3.5 w-3.5 rounded border-line accent-linc-600"
                          />
                          Reply anonymously
                        </label>
                        ) : (
                          <span />
                        )}
                        <button
                          type="submit"
                          className="rounded-full bg-linc-600 px-3 py-1 text-[12px] font-semibold text-white transition hover:bg-linc-700"
                        >
                          Post reply
                        </button>
                      </div>
                    </form>
                  </details>
                )}
                {session && comment.author_id === session.id && (
                  <details className="min-w-0">
                    <summary className="cursor-pointer list-none rounded-full px-2 py-1 text-[12px] font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-ink">
                      Edit
                    </summary>
                    <form action={editComment} className="mt-2 space-y-2">
                      <input type="hidden" name="commentId" value={comment.id} />
                      <label htmlFor={`edit-${comment.id}`} className="sr-only">
                        Edit your comment
                      </label>
                      <textarea
                        id={`edit-${comment.id}`}
                        name="body"
                        rows={3}
                        required
                        maxLength={1000}
                        defaultValue={comment.body}
                        className="w-full resize-none rounded-xl border border-line px-3 py-2 text-[14px] text-ink outline-none transition focus:border-linc-400 focus:ring-4 focus:ring-linc-50"
                      />
                      <button
                        type="submit"
                        className="rounded-full bg-linc-600 px-3 py-1 text-[12px] font-semibold text-white transition hover:bg-linc-700"
                      >
                        Save changes
                      </button>
                    </form>
                  </details>
                )}
                {session &&
                  (session.role === "admin" || comment.author_id === session.id) && (
                    <form action={deleteComment}>
                      <input type="hidden" name="commentId" value={comment.id} />
                      <ConfirmSubmit
                        message="Delete this comment? Replies stay on the post."
                        className="rounded-full px-2 py-1 text-[12px] font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-rose-600"
                      >
                        Delete
                      </ConfirmSubmit>
                    </form>
                  )}
              </div>
            </div>
          </article>
          {replies}
        </div>
      );
    });


  return (
    <div className="pb-4">
      <AutoRefresh seconds={15} />
      <HashOpener />

      <PageHeader
        title="Post"
        subtitle={entry.category_label}
        backHref={`/c/${entry.category_slug}`}
        backLabel={`Back to ${entry.category_label}`}
        actions={
          <>
            {canEditPost && (
              <Link
                href={`/c/${entry.category_slug}/${entry.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
              >
                <PencilIcon className="h-4 w-4" />
                Edit
              </Link>
            )}
            {entry.status !== "published" ? <StatusBadge status={entry.status} /> : undefined}
          </>
        }
      />

      {message.text && (
        <Notice kind={message.kind === "error" ? "error" : "success"}>{message.text}</Notice>
      )}

      {/* Root post */}
      <article className="relative flex gap-3 px-4 pt-4">
        <PostMore
          entry={entry}
          viewerId={session?.id}
          returnTo={`/c/${entry.category_slug}/${entry.id}`}
          canManage={canDelete}
          canEdit={canEditPost}
        />

        <div className="flex flex-col items-center">
          {authorHref ? (
            <Link href={authorHref} aria-label={`View ${author}'s profile`} className="rounded-full">
              <Avatar
                name={author}
                anonymous={Boolean(entry.is_anonymous)}
                src={authorAvatar}
                size={40}
              />
            </Link>
          ) : (
            <Avatar
              name={author}
              anonymous={Boolean(entry.is_anonymous)}
              src={authorAvatar}
              size={40}
            />
          )}
          <span className="mt-2 w-px flex-1 bg-line" />
        </div>

        <div className="min-w-0 flex-1 pb-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-8">
            {authorHref ? (
              <Link
                href={authorHref}
                className="text-[15px] font-semibold text-ink transition hover:underline"
              >
                {author}
              </Link>
            ) : (
              <span className="text-[15px] font-semibold text-ink">{author}</span>
            )}
            <CategoryChip
              slug={entry.category_slug}
              label={entry.category_label}
              href={`/c/${entry.category_slug}`}
              className="text-[11px]"
            />
          </div>
          <p className="text-[12px] text-neutral-500">{formatDateTime(entry.created_at)}</p>
          {trackingCode && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-neutral-500">
              Tracking code
              <code className="select-all rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px] font-semibold tracking-wider text-ink">
                {trackingCode}
              </code>
              <CopyButton value={trackingCode} />
              <Link href="/track" className="font-semibold text-linc-700 hover:underline">
                Track
              </Link>
            </p>
          )}

          <h1 className="mt-2 text-[21px] font-bold leading-[1.28] tracking-[-0.02em] text-ink">
            {entry.title}
          </h1>

          <div className="mt-2 space-y-3 text-[15px] leading-[1.5] text-neutral-800">
            {paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          {attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {attachments.map((file) => (
                <AttachmentPreview key={file.id} file={file} />
              ))}
            </div>
          )}

          {entry.status === "rejected" && entry.reject_reason && (
            <p className="mt-3 border-l-2 border-rose-400 py-1 pl-3 text-[13px] text-rose-700">
              <span className="font-semibold">Returned by the USC administrator:</span> {entry.reject_reason}
            </p>
          )}

          {entry.status === "redacted" && entry.reject_reason && (
            <p className="mt-3 border-l-2 border-rose-400 py-1 pl-3 text-[13px] text-rose-700">
              <span className="font-semibold">This post will be deleted due to:</span> {entry.reject_reason}
            </p>
          )}

          <div className="mt-3 -ml-2 flex items-center gap-1">
            <LikeButton
              entry={entry}
              viewerId={session?.id}
              returnTo={`/c/${entry.category_slug}/${entry.id}`}
            />
            <a
              href="#discussion"
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-neutral-500 transition hover:bg-neutral-100 hover:text-ink"
            >
              <CommentIcon className="h-[18px] w-[18px]" />
              {comments.length}
            </a>
            <RepostButton
              entry={entry}
              viewerId={session?.id}
              returnTo={`/c/${entry.category_slug}/${entry.id}`}
            />
          </div>
        </div>
      </article>

      {/* Replies */}
      <section id="discussion" className="border-t border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <h2 className="text-[13px] font-semibold text-neutral-500">
            {comments.length} {comments.length === 1 ? "comment" : "comments"}
          </h2>
          {comments.length > 1 && (
            <nav aria-label="Sort comments" className="flex items-center gap-1">
              {COMMENT_SORTS.map((option) => (
                <Link
                  key={option.value}
                  href={
                    option.value === "oldest"
                      ? `${base}#discussion`
                      : `${base}?sort=${option.value}#discussion`
                  }
                  aria-current={sort === option.value ? "true" : undefined}
                  className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition ${
                    sort === option.value
                      ? "bg-ink text-white"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-ink"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {comments.length === 0 ? (
          <p className="px-4 pb-4 text-[14px] text-neutral-400">
            No comments yet. Start the conversation below.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {renderComments(null, 0)}
          </div>
        )}

        {session ? (
          <form
            action={addComment}
            className="mt-1 flex items-start gap-3 border-t border-line px-4 py-3"
          >
            <Avatar name={myName} src={myAvatar} size={34} />
            <input type="hidden" name="entryId" value={entry.id} />
            <input type="hidden" name="slug" value={entry.category_slug} />
            <div className="min-w-0 flex-1">
              <textarea
                name="body"
                rows={2}
                required
                placeholder="Add a helpful reply… Use @nickname to mention someone"
                className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink placeholder:text-neutral-400 outline-none"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                {session.role !== "admin" ? (
                <label className="flex items-center gap-1.5 text-[12px] text-neutral-500">
                  <input
                    type="checkbox"
                    name="isAnonymous"
                    className="h-3.5 w-3.5 rounded border-line accent-linc-600"
                  />
                  Post anonymously
                </label>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  className="rounded-full bg-linc-600 px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-linc-700"
                >
                  Post comment
                </button>
              </div>
            </div>
          </form>
        ) : (
          <p className="border-t border-line px-4 py-4 text-[14px] text-neutral-500">
            <Link href="/login" className="font-semibold text-linc-700 hover:underline">
              Sign in
            </Link>{" "}
            to join the discussion.
          </p>
        )}
      </section>

      {entry.status === "published" && session && (
        <section id="report" className="border-t border-line px-4 py-4">
          <ReportButton
            entryId={entry.id}
            slug={entry.category_slug}
            className="cursor-pointer text-[13px] font-semibold text-neutral-500 hover:text-ink"
          >
            Report this post
          </ReportButton>
        </section>
      )}

      {timeline.length > 0 && (
        <section className="border-t border-line px-4 py-4">
          <h2 className="text-[13px] font-semibold text-neutral-500">Moderation history</h2>
          <ul className="mt-2.5 space-y-2">
            {timeline.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-neutral-600">
                <span className="text-neutral-400">{formatDateTime(item.created_at)}</span>
                <span className="font-medium text-ink">{item.actor_name}</span>
                <span>
                  {item.from_status} → <span className="font-medium">{item.to_status}</span>
                </span>
                {item.reason && <span className="text-neutral-400">“{item.reason}”</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type CommentSort = "oldest" | "newest" | "top";

const COMMENT_SORTS: Array<{ value: CommentSort; label: string }> = [
  { value: "oldest", label: "Oldest" },
  { value: "newest", label: "Newest" },
  { value: "top", label: "Top" },
];

/** Reply chains with more replies than this start collapsed. */
const COLLAPSE_AFTER = 2;

function countReplies(groups: Map<string | null, CommentRecord[]>, id: string): number {
  return (groups.get(id) ?? []).reduce(
    (total, reply) => total + 1 + countReplies(groups, reply.id),
    0,
  );
}

/** Orphaned replies (parent deleted) fall back to the root of the discussion. */
function groupComments(
  comments: CommentRecord[],
  sort: CommentSort,
): Map<string | null, CommentRecord[]> {
  const ids = new Set(comments.map((comment) => comment.id));
  const groups = new Map<string | null, CommentRecord[]>();

  for (const comment of comments) {
    const parentId =
      comment.parent_id && ids.has(comment.parent_id) ? comment.parent_id : null;
    const bucket = groups.get(parentId) ?? [];
    bucket.push(comment);
    groups.set(parentId, bucket);
  }

  // Only top-level comments are re-ordered; replies stay chronological.
  const roots = groups.get(null);
  if (roots) {
    if (sort === "newest") roots.sort((a, b) => b.created_at - a.created_at);
    if (sort === "top") {
      roots.sort((a, b) => b.like_count - a.like_count || a.created_at - b.created_at);
    }
  }

  return groups;
}

