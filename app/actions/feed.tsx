"use server";

import { Fragment, type ReactNode } from "react";
import { feedAd } from "@/components/linc/ad-card";
import { PostCard } from "@/components/linc/post-card";
import { reelSlides, type ReelSlideData } from "@/components/linc/reel-slide";
import { getSession } from "@/lib/auth/session";
import {
  attachViewerState,
  getCategoryBySlug,
  getUserByUsername,
  listPublishedByAuthor,
  listPublishedEntries,
  listRepostedEntries,
  listSavedEntries,
  PAGE_SIZE,
  type EntryRecord,
  type Page,
} from "@/lib/db/queries";
import { listForYouEntries } from "@/lib/recommend/db";

/** The next page of the home feed as reel slides (one post per screen). */
export async function loadMoreReels(
  param: string,
  cursor: string,
  pages = 1,
): Promise<{ slides: ReelSlideData[]; nextCursor: string | null }> {
  if (typeof cursor !== "string") return { slides: [], nextCursor: null };

  const session = await getSession();
  const limit = PAGE_SIZE * Math.min(Math.max(Math.floor(pages) || 1, 1), 20);
  const category = param && await getCategoryBySlug(param) ? param : undefined;
  const page =
    (!category && await listForYouEntries(session?.id, { limit, cursor })) ||
    await listPublishedEntries({ categorySlug: category, limit, cursor });
  await attachViewerState(page.items, session?.id);

  return {
    nextCursor: page.nextCursor,
    slides: await reelSlides(page.items, session?.id, `/?view=reels${category ? `&category=${category}` : ""}`),
  };
}

export type FeedSource = "home" | "category" | "saved" | "posts" | "reposts";

export type LoadedPage = { node: ReactNode; nextCursor: string | null };

const SOURCES = new Set<FeedSource>(["home", "category", "saved", "posts", "reposts"]);

/**
 * Returns the next page of post cards as server-rendered UI. `pages` lets the
 * client re-fetch everything it has loaded so far after a refresh, which keeps
 * like/save state on "loaded more" posts from going stale.
 */
export async function loadMoreEntries(
  source: FeedSource,
  param: string,
  cursor: string,
  pages = 1,
): Promise<LoadedPage> {
  if (!SOURCES.has(source) || typeof cursor !== "string") return { node: null, nextCursor: null };

  const session = await getSession();
  const limit = PAGE_SIZE * Math.min(Math.max(Math.floor(pages) || 1, 1), 20);
  let page: Page<EntryRecord> = { items: [], nextCursor: null };
  let returnTo = "/";

  if (source === "home") {
    const category = param && await getCategoryBySlug(param) ? param : undefined;
    page =
      (!category && await listForYouEntries(session?.id, { limit, cursor })) ||
      await listPublishedEntries({ categorySlug: category, limit, cursor });
    returnTo = category ? `/?category=${category}` : "/";
  } else if (source === "category") {
    if (await getCategoryBySlug(param)) {
      page = await listPublishedEntries({ categorySlug: param, limit, cursor });
      returnTo = `/c/${param}`;
    }
  } else if (source === "saved") {
    if (session) page = await listSavedEntries(session.id, { limit, cursor });
    returnTo = "/saved";
  } else {
    const profile = await getUserByUsername(param);
    if (profile) {
      page =
        source === "reposts"
          ? await listRepostedEntries(profile.id, { limit, cursor })
          : await listPublishedByAuthor(profile.id, { limit, cursor });
      returnTo = `/u/${profile.username}${source === "reposts" ? "?tab=reposts" : ""}`;
    }
  }

  await attachViewerState(page.items, session?.id);

  return {
    nextCursor: page.nextCursor,
    node: page.items.map((entry, index) => (
      <Fragment key={entry.id}>
        <PostCard entry={entry} viewerId={session?.id} returnTo={returnTo} />
        {source === "home" || source === "category" ? feedAd(index) : null}
      </Fragment>
    )),
  };
}
