import Link from "next/link";
import { ActivityPanel } from "@/components/linc/activity-feed";
import { PageHeader } from "@/components/linc/page-header";
import { PostCard } from "@/components/linc/post-card";
import { Avatar } from "@/components/linc/avatar";
import { EmptyState, Notice } from "@/components/linc/empty-state";
import { ActivityIcon, BookmarkIcon, PlusIcon, ArrowUpRightIcon, SettingsIcon } from "@/components/linc/icons";
import { requireUser } from "@/lib/auth/session";
import {
  attachViewerState,
  countUnreadNotifications,
  getAccountById,
  listActivity,
  listByAuthor,
  listNotifications,
  listOutgoingActivity,
} from "@/lib/db/queries";
import { buildActivityFeed, parseActivityFilter } from "@/lib/activity";
import { submitDraft } from "@/app/actions/posts";
import { avatarSrc } from "@/lib/avatars";
import { messageFrom } from "@/lib/redirects";

export default async function MyActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; tab?: string; filter?: string }>;
}) {
  const session = await requireUser("/me");
  const account = await getAccountById(session.id);
  const myAvatar = avatarSrc(session.id, Boolean(account?.avatar_path));
  const sp = await searchParams;
  const tab =
    sp.tab === "activity" ? "activity" : sp.tab === "drafts" ? "drafts" : "posts";
  const entries = await listByAuthor(session.id);
  await attachViewerState(entries, session.id);
  const drafts = entries.filter((entry) => entry.status === "draft");
  const posts = entries.filter((entry) => entry.status !== "draft");
  const incoming = await listActivity(session.id);
  const outgoing = await listOutgoingActivity(session.id);
  const notifications = await listNotifications(session.id);
  const feed = buildActivityFeed({ incoming, outgoing, notifications });
  const unread = await countUnreadNotifications(session.id);
  const message = messageFrom({
    error: typeof sp.error === "string" ? sp.error : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });

  return (
    <div>
      <PageHeader
        title="My activity"
        actions={
          <>
            <Link
              href="/submit"
              aria-label="New post"
              className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink transition hover:bg-neutral-50"
            >
              <PlusIcon className="h-5 w-5" />
            </Link>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </>
        }
      />

      <section className="border-b border-line px-4 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold tracking-[-0.02em] text-ink">
              {session.displayName}
            </h2>
            <p className="text-[14px] text-neutral-500">@{session.username}</p>
            <span className="mt-2 inline-flex rounded-full border border-line px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {session.role}
            </span>
          </div>
          <Avatar name={session.displayName} src={myAvatar} size={64} className="ring-1 ring-line" />
        </div>

        <p className="mt-4 text-[14px] text-neutral-600">
          {posts.length} {posts.length === 1 ? "post" : "posts"} ·{" "}
          {drafts.length} {drafts.length === 1 ? "draft" : "drafts"} ·{" "}
          {feed.length} recent {feed.length === 1 ? "activity update" : "activity updates"}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/saved"
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
          >
            <BookmarkIcon className="h-4 w-4" />
            Saved posts
          </Link>
          <Link
            href="/activity"
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
          >
            <ActivityIcon className="h-4 w-4" />
            Activity
            {unread > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white">
                {unread}
              </span>
            )}
          </Link>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
          >
            <SettingsIcon className="h-4 w-4" />
            Edit account
          </Link>
          <Link
            href={`/u/${session.username}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
          >
            <ArrowUpRightIcon className="h-4 w-4" />
            Public profile
          </Link>
        </div>
      </section>

      <nav className="flex border-b border-line" aria-label="My sections">
        <Link
          href="/me"
          aria-current={tab === "posts" ? "page" : undefined}
          className={`relative flex-1 py-3 text-center text-[13px] font-semibold transition hover:bg-neutral-50 ${
            tab === "posts" ? "text-ink" : "text-neutral-500"
          }`}
        >
          Posts
          {tab === "posts" && (
            <span className="absolute inset-x-0 bottom-0 mx-auto h-[2px] w-12 rounded-full bg-ink" />
          )}
        </Link>
        <Link
          href="/me?tab=drafts"
          aria-current={tab === "drafts" ? "page" : undefined}
          className={`relative flex-1 py-3 text-center text-[13px] font-semibold transition hover:bg-neutral-50 ${
            tab === "drafts" ? "text-ink" : "text-neutral-500"
          }`}
        >
          Drafts
          {drafts.length > 0 && (
            <span className="ml-1 rounded-full bg-neutral-200 px-1.5 text-[10px] font-bold text-neutral-600">
              {drafts.length}
            </span>
          )}
          {tab === "drafts" && (
            <span className="absolute inset-x-0 bottom-0 mx-auto h-[2px] w-12 rounded-full bg-ink" />
          )}
        </Link>
        <Link
          href="/me?tab=activity"
          aria-current={tab === "activity" ? "page" : undefined}
          className={`relative flex-1 py-3 text-center text-[13px] font-semibold transition hover:bg-neutral-50 ${
            tab === "activity" ? "text-ink" : "text-neutral-500"
          }`}
        >
          Activity
          {tab === "activity" && (
            <span className="absolute inset-x-0 bottom-0 mx-auto h-[2px] w-12 rounded-full bg-ink" />
          )}
        </Link>
      </nav>

      {message.text && (
        <Notice kind={message.kind === "error" ? "error" : "success"}>{message.text}</Notice>
      )}

      {tab === "activity" ? (
        <ActivityPanel
          items={feed}
          unread={unread}
          filter={parseActivityFilter(sp.filter)}
          basePath="/me?tab=activity"
        />
      ) : tab === "drafts" ? (
        <>
          <p className="border-b border-line bg-canvas px-4 py-2.5 text-[12px] leading-relaxed text-linc-700">
            Drafts are private to your account. They enter the admin queue only after you submit
            them for review.
          </p>

          {drafts.length === 0 ? (
            <EmptyState
              title="No drafts"
              description="Start a post and choose Save draft to keep it here until you are ready."
              art="drafts"
              action={
                <Link
                  href="/submit"
                  className="inline-flex rounded-full bg-linc-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-linc-700"
                >
                  Write a post
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-line">
              {drafts.map((entry) => (
                <div key={entry.id}>
                  <PostCard
                    entry={entry}
                    showStatus
                    viewerId={session.id}
                    returnTo="/me?tab=drafts"
                  />
                  <form action={submitDraft} className="px-4 pb-3.5">
                    <input type="hidden" name="entryId" value={entry.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-line px-3.5 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
                    >
                      Submit for review
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="border-b border-line bg-canvas px-4 py-2.5 text-[12px] leading-relaxed text-linc-700">
            Anonymous submissions are deliberately excluded here — they are stored under a generated
            pseudonym so they cannot be traced back to your account.
          </p>

          {posts.length === 0 ? (
            <EmptyState
              title="No posts yet"
              description="Submit a concern, question, or announcement and it will appear here while it waits for admin review."
              action={
                <Link
                  href="/submit"
                  className="inline-flex rounded-full bg-linc-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-linc-700"
                >
                  Submit an entry
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-line">
              {posts.map((entry) => (
                <PostCard
                  key={entry.id}
                  entry={entry}
                  showStatus
                  viewerId={session.id}
                  returnTo="/me"
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
