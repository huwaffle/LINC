export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/linc/avatar";
import { EmptyState } from "@/components/linc/empty-state";
import { PageHeader } from "@/components/linc/page-header";
import { LoadMore } from "@/components/linc/load-more";
import { PostCard } from "@/components/linc/post-card";
import { getSession } from "@/lib/auth/session";
import {
  attachViewerState,
  getUserByUsername,
  listPublishedByAuthor,
  listRepostedEntries,
} from "@/lib/db/queries";
import { avatarSrc } from "@/lib/avatars";
import { formatDate } from "@/lib/format";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  student: "Student",
};

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const sp = await searchParams;
  const profile = await getUserByUsername(decodeURIComponent(username));
  if (!profile) notFound();

  const session = await getSession();
  const tab = sp.tab === "reposts" ? "reposts" : "posts";
  const { items: entries, nextCursor } =
    tab === "reposts"
      ? await listRepostedEntries(profile.id)
      : await listPublishedByAuthor(profile.id);
  await attachViewerState(entries, session?.id);

  const isMe = session?.id === profile.id;
  const roleLabel = ROLE_LABEL[profile.role] ?? "Member";

  return (
    <div>
      <PageHeader
        title={profile.display_name}
        subtitle={`@${profile.username}`}
        backHref="/"
        backLabel="Back to feed"
        actions={
          isMe ? (
            <div className="flex items-center gap-2">
              <Link
                href="/settings"
                className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
              >
                Edit profile
              </Link>
              <Link
                href="/me"
                className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-ink"
              >
                My activity
              </Link>
            </div>
          ) : undefined
        }
      />

      <header className="border-b border-line px-4 pb-4 pt-5">
        <div className="flex items-start gap-3">
          <Avatar
            name={profile.display_name}
            src={avatarSrc(profile.id, profile.has_avatar)}
            size={64}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
              {profile.display_name}
            </h1>
            <p className="mt-0.5 text-[13px] text-neutral-500">@{profile.username}</p>
            <p className="mt-1 text-[12px] font-medium text-linc-700">{roleLabel}</p>
          </div>
        </div>

        <p className="mt-3 text-[13px] text-neutral-500">
          {profile.role === "admin"
            ? "Official LINC account posting announcements and updates for the community."
            : "Lasallian student sharing updates, concerns, and finds with the community."}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-neutral-500">
          <span>Joined {formatDate(profile.created_at)}</span>
        </div>

        <dl className="mt-4 flex items-center gap-6">
          <div>
            <dd className="text-[17px] font-bold leading-none text-ink">{profile.post_count}</dd>
            <dt className="mt-1 text-[12px] text-neutral-500">Posts</dt>
          </div>
          <div>
            <dd className="text-[17px] font-bold leading-none text-ink">{profile.repost_count}</dd>
            <dt className="mt-1 text-[12px] text-neutral-500">Reposts</dt>
          </div>
          <div>
            <dd className="text-[17px] font-bold leading-none text-ink">{profile.like_count}</dd>
            <dt className="mt-1 text-[12px] text-neutral-500">Likes</dt>
          </div>
        </dl>
      </header>

      <nav className="flex border-b border-line" aria-label="Profile sections">
        <Link
          href={`/u/${profile.username}`}
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
          href={`/u/${profile.username}?tab=reposts`}
          aria-current={tab === "reposts" ? "page" : undefined}
          className={`relative flex-1 py-3 text-center text-[13px] font-semibold transition hover:bg-neutral-50 ${
            tab === "reposts" ? "text-ink" : "text-neutral-500"
          }`}
        >
          Reposts
          {tab === "reposts" && (
            <span className="absolute inset-x-0 bottom-0 mx-auto h-[2px] w-12 rounded-full bg-ink" />
          )}
        </Link>
      </nav>

      {entries.length === 0 ? (
        <EmptyState
          title={tab === "reposts" ? "No reposts yet" : "No posts yet"}
          description={
            tab === "reposts"
              ? "Posts this account reposts will show up here."
              : "Published posts from this account will show up here."
          }
          art="profile"
        />
      ) : (
        <div className="divide-y divide-line">
          <LoadMore source={tab} param={profile.username} initialCursor={nextCursor}>
            {entries.map((entry) => (
              <PostCard
                key={entry.id}
                entry={entry}
                viewerId={session?.id}
                returnTo={
                  tab === "reposts"
                    ? `/u/${profile.username}?tab=reposts`
                    : `/u/${profile.username}`
                }
              />
            ))}
          </LoadMore>
        </div>
      )}
    </div>
  );
}
