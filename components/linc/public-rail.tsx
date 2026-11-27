import Link from "next/link";
import { AdSlideshow } from "./ad-slideshow";
import { listActiveAds } from "@/lib/db/ads";
import {
  listCategories,
  listTrendingEntries,
} from "@/lib/db/queries";
import { formatDateTime } from "@/lib/format";
import { getSuggestions, listEventsForYou } from "@/lib/recommend/db";

export async function PublicRailAd() {
  const ads = (await listActiveAds()).map((ad) => ({
    id: ad.id,
    title: ad.title,
    body: ad.body,
    sponsor: ad.sponsor,
    hasImage: Boolean(ad.image_path),
  }));

  return ads.length > 0 ? <AdSlideshow ads={ads} /> : null;
}

export async function PublicRail({ userId }: { userId?: string | null }) {
  const events = (await listEventsForYou(userId)).slice(0, 3);
  const suggestions = await getSuggestions(userId);
  const trending = await listTrendingEntries(7, 5);
  const categories = await listCategories();
  const posts = categories.reduce((sum, category) => sum + category.total, 0);

  return (
    <div className="flex flex-col gap-4 pb-10">
      <section className="rounded-2xl border border-line bg-white">
        <header className="flex items-baseline justify-between px-4 pt-4">
          <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">Upcoming events</h2>
          <Link
            href="/events"
            className="text-[12px] font-semibold text-neutral-500 transition hover:text-ink"
          >
            View all
          </Link>
        </header>

        {events.length === 0 ? (
          <p className="px-4 pb-4 pt-2 text-[13px] text-neutral-500">No events scheduled yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {events.map((event) => {
              const date = new Date(event.starts_at);
              const month = date.toLocaleDateString("en-PH", {
                month: "short",
                timeZone: "Asia/Manila",
              });
              const day = date.toLocaleDateString("en-PH", {
                day: "numeric",
                timeZone: "Asia/Manila",
              });

              return (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="flex gap-3 px-4 py-3 transition hover:bg-neutral-50/70"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-canvas text-center">
                      <span className="block text-[9px] font-bold uppercase leading-none tracking-wide text-linc-600">
                        {month}
                      </span>
                      <span className="mt-1 block text-[15px] font-bold leading-none text-ink">
                        {day}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] text-neutral-400">
                        {formatDateTime(event.starts_at)}
                      </span>
                      <span className="mt-1 block truncate text-[13px] font-semibold text-ink">
                        {event.title}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {suggestions && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">Suggested for you</h2>
          <p className="mt-1 text-[12px] text-neutral-400">Based on what you read and react to.</p>
          {suggestions.categories.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {suggestions.categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/?category=${category.slug}`}
                  className="inline-flex rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-ink transition hover:border-linc-200 hover:bg-linc-50 hover:text-linc-700"
                >
                  {category.label}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {trending.length > 0 && (
        <section className="rounded-2xl border border-line bg-white">
          <header className="flex items-baseline justify-between px-4 pt-4">
            <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">
              Trending this week
            </h2>
            <span className="text-[11px] font-medium text-neutral-400">Last 7 days</span>
          </header>
          <ol className="mt-2 divide-y divide-line">
            {trending.map((post, index) => (
              <li key={post.id}>
                <Link
                  href={`/c/${post.category_slug}/${post.id}`}
                  className="flex gap-3 px-4 py-2.5 transition hover:bg-neutral-50/70"
                >
                  <span className="mt-0.5 text-[13px] font-bold text-neutral-300">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold leading-snug text-ink">
                      {post.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-neutral-400">
                      {post.category_label} - {post.like_count} likes -{" "}
                      {post.comment_count} replies
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-white p-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">Browse categories</h2>
          <span className="text-[11px] font-medium text-neutral-400">{posts} posts</span>
        </header>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/?category=${category.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-ink transition hover:border-linc-200 hover:bg-linc-50 hover:text-linc-700"
            >
              {category.label}
              <span className="text-[10px] font-semibold text-neutral-400">{category.total}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">About LINC</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
          A Lasallian space for concerns, updates, and events. Every post is reviewed by the
          USC administrator before it goes live, and you can post anonymously when it matters.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Categories
            </dt>
            <dd className="mt-0.5 text-[17px] font-bold leading-none text-ink">
              {categories.length}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Posts
            </dt>
            <dd className="mt-0.5 text-[17px] font-bold leading-none text-ink">{posts}</dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 text-[11px] text-neutral-400">
        <span>© 2026</span>
        <Link href="/about#terms" className="transition hover:text-ink">
          LINC Terms
        </Link>
        <Link href="/about#privacy" className="transition hover:text-ink">
          Privacy Policy
        </Link>
        <Link href="/about#cookies" className="transition hover:text-ink">
          Cookies Policy
        </Link>
        <Link href="/about#cookie-settings" className="transition hover:text-ink">
          Cookie Settings
        </Link>
        <Link href="/about#report" className="transition hover:text-ink">
          Report a problem
        </Link>
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-neutral-400">
        De La Salle Araneta University
        <br />
        Lasallian Information Network and Community
      </p>
    </div>
  );
}
