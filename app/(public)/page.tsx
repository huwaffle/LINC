import { Fragment } from "react";
import Link from "next/link";
import { feedAd } from "@/components/linc/ad-card";
import { LoadMore } from "@/components/linc/load-more";
import { reelSlides } from "@/components/linc/reel-slide";
import { ReelsViewer } from "@/components/linc/reels-viewer";
import { PostCard } from "@/components/linc/post-card";
import { PageHeader } from "@/components/linc/page-header";
import { Avatar } from "@/components/linc/avatar";
import { EmptyState, Notice } from "@/components/linc/empty-state";
import { PlusIcon } from "@/components/linc/icons";
import { getSession } from "@/lib/auth/session";
import {
  attachViewerState,
  getAccountById,
  listCategories,
  listPublishedEntries,
} from "@/lib/db/queries";
import { avatarSrc } from "@/lib/avatars";
import { messageFrom } from "@/lib/redirects";
import { listForYouEntries } from "@/lib/recommend/db";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; view?: string; notice?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const account = session ? await getAccountById(session.id) : undefined;
  const categories = await listCategories();
  const active =
    typeof sp.category === "string" && categories.some((c) => c.slug === sp.category)
      ? sp.category
      : undefined;

  const reels = sp.view !== "list";
  const viewHref = (view: "list" | "reels", category?: string) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (view === "list") params.set("view", "list");
    const query = params.toString();
    return query ? `/?${query}` : "/";
  };

  const { items: entries, nextCursor } =
    (!active && await listForYouEntries(session?.id)) || await listPublishedEntries({ categorySlug: active });
  await attachViewerState(entries, session?.id);
  const message = messageFrom({
    error: typeof sp.error === "string" ? sp.error : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });
  const composeHref = session ? "/submit" : "/login?next=/submit";

  return (
    <div>
      <PageHeader
        title="Home"
        actions={
          <>
            <div className="flex rounded-full border border-line p-0.5 text-[12px] font-semibold">
              {(["list", "reels"] as const).map((view) => (
                <Link
                  key={view}
                  href={viewHref(view, active)}
                  aria-current={(view === "reels") === reels ? "page" : undefined}
                  className={`rounded-full px-3 py-1 capitalize transition ${
                    (view === "reels") === reels ? "bg-ink text-white" : "text-neutral-500 hover:text-ink"
                  }`}
                >
                  {view}
                </Link>
              ))}
            </div>
          <Link
            href={composeHref}
            aria-label="New post"
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink transition hover:bg-neutral-50"
          >
            <PlusIcon className="h-5 w-5" />
          </Link>
          </>
        }
      >
        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          <Link
            href={viewHref(reels ? "reels" : "list")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
              !active ? "bg-ink text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-ink"
            }`}
          >
            For you
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={viewHref(reels ? "reels" : "list", category.slug)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                active === category.slug
                  ? "bg-ink text-white"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-ink"
              }`}
            >
              {category.label}
            </Link>
          ))}
        </div>
      </PageHeader>

      {message.text && (
        <Notice kind={message.kind === "error" ? "error" : "success"}>{message.text}</Notice>
      )}

      {!reels && (
      <Link
        href={composeHref}
        className="flex items-center gap-3 border-b border-line px-4 py-3.5 transition hover:bg-neutral-50/60"
      >
        <Avatar
          name={session?.displayName ?? "Guest"}
          src={session ? avatarSrc(session.id, Boolean(account?.avatar_path)) : undefined}
          size={36}
        />
        <span className="text-[15px] text-neutral-400">
          {session ? "Raise a concern or share a post…" : "Sign in to share a post…"}
        </span>
        <span className="ml-auto rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink">
          Post
        </span>
      </Link>
      )}

      {entries.length === 0 ? (
        <EmptyState
          title="No posts yet"
          description="No published entries match this category. The USC administrator reviews submissions before they appear here."
          action={
            <Link
              href={composeHref}
              className="inline-flex rounded-full bg-linc-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-linc-700"
            >
              Share the first post
            </Link>
          }
        />
      ) : reels ? (
        <ReelsViewer
          key={active ?? "for-you"}
          slides={await reelSlides(entries, session?.id, viewHref("reels", active))}
          param={active ?? ""}
          initialCursor={nextCursor}
        />
      ) : (
        <div className="divide-y divide-line">
          <LoadMore source="home" param={active ?? ""} initialCursor={nextCursor}>
            {entries.map((entry, index) => (
              <Fragment key={entry.id}>
                <PostCard
                  entry={entry}
                  viewerId={session?.id}
                  returnTo={active ? `/?category=${active}` : "/"}
                />
                {feedAd(index)}
              </Fragment>
            ))}
          </LoadMore>
        </div>
      )}

      {!reels && (
      <p className="px-4 py-8 text-center text-[12px] text-neutral-400 lg:hidden">
        Lasallian Information Network and Community · De La Salle Araneta University
      </p>
      )}
    </div>
  );
}
