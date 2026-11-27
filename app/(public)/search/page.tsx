export const dynamic = "force-dynamic";

import Link from "next/link";
import { PostCard } from "@/components/linc/post-card";
import { PageHeader } from "@/components/linc/page-header";
import { EmptyState } from "@/components/linc/empty-state";
import { SearchHistory } from "@/components/linc/search-history";
import { SearchInput } from "@/components/linc/search-input";
import { tokenizeQuery } from "@/lib/search";
import { getSession } from "@/lib/auth/session";
import {
  attachViewerState,
  listCategories,
  searchCategories,
  searchEntries,
  searchHelp,
  type SearchSort,
} from "@/lib/db/queries";

const SORTS: Array<{ value: SearchSort; label: string }> = [
  { value: "relevance", label: "Best match" },
  { value: "newest", label: "Newest" },
  { value: "liked", label: "Most liked" },
  { value: "discussed", label: "Most discussed" },
];

const DATE_INPUT = /^\d{4}-\d{2}-\d{2}$/;

/** Date inputs are interpreted in Manila time, matching the rest of the UI. */
function dayStart(value: string | undefined): number | undefined {
  if (!value || !DATE_INPUT.test(value)) return undefined;
  const ms = new Date(`${value}T00:00:00+08:00`).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

function dayEnd(value: string | undefined): number | undefined {
  if (!value || !DATE_INPUT.test(value)) return undefined;
  const ms = new Date(`${value}T23:59:59.999+08:00`).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const categoryId = typeof sp.category === "string" ? sp.category : "";
  const sortValue = typeof sp.sort === "string" ? sp.sort : "";
  const sort: SearchSort = SORTS.some((option) => option.value === sortValue)
    ? (sortValue as SearchSort)
    : "relevance";
  const fromValue = typeof sp.from === "string" ? sp.from : "";
  const toValue = typeof sp.to === "string" ? sp.to : "";
  const from = dayStart(fromValue);
  const to = dayEnd(toValue);

  const categories = await listCategories();
  const results = q
    ? await searchEntries(q, { categoryId: categoryId || undefined, from, to, sort })
    : [];
  const help = q && results.length === 0 ? await searchHelp(q) : null;
  const matchedCategories = await searchCategories(q);
  const terms = tokenizeQuery(q);
  const session = await getSession();
  if (q) await attachViewerState(results, session?.id);

  const filterCount = [from, to, sort !== "relevance" ? sort : ""].filter(Boolean).length;

  const returnParams = new URLSearchParams();
  if (q) returnParams.set("q", q);
  if (categoryId) returnParams.set("category", categoryId);
  if (sort !== "relevance") returnParams.set("sort", sort);
  if (fromValue) returnParams.set("from", fromValue);
  if (toValue) returnParams.set("to", toValue);
  const hrefWithout = (...keys: string[]) => {
    const params = new URLSearchParams(returnParams);
    keys.forEach((key) => params.delete(key));
    return `/search${params.size ? `?${params.toString()}` : ""}`;
  };
  const chips = [
    categoryId && {
      label: `Category: ${categories.find((c) => c.id === categoryId)?.label ?? categoryId}`,
      href: hrefWithout("category"),
    },
    fromValue && { label: `From ${fromValue}`, href: hrefWithout("from") },
    toValue && { label: `To ${toValue}`, href: hrefWithout("to") },
    sort !== "relevance" && {
      label: `Order: ${SORTS.find((option) => option.value === sort)?.label}`,
      href: hrefWithout("sort"),
    },
  ].filter((chip): chip is { label: string; href: string } => Boolean(chip));
  const returnTo = `/search${returnParams.size ? `?${returnParams.toString()}` : ""}`;

  return (
    <div>
      <PageHeader title="Search">
        <form method="get" action="/search" className="flex min-w-0 flex-1 items-center gap-2">
          <SearchInput defaultValue={q} />
          <select
            id="category"
            name="category"
            defaultValue={categoryId}
            aria-label="Category"
            className="max-w-[110px] rounded-xl border border-line bg-white px-2 py-2 text-[12px] font-medium text-ink outline-none"
          >
            <option value="">All</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
          {sort !== "relevance" && <input type="hidden" name="sort" value={sort} />}
          {fromValue && <input type="hidden" name="from" value={fromValue} />}
          {toValue && <input type="hidden" name="to" value={toValue} />}
          <button
            type="submit"
            className="rounded-full bg-linc-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-linc-700"
          >
            Search
          </button>
        </form>
      </PageHeader>

      <details className="border-b border-line" open={filterCount > 0}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-[12px] font-semibold text-neutral-500 transition hover:text-ink [&::-webkit-details-marker]:hidden">
          <span>
            Filters
            {filterCount > 0 && (
              <span className="ml-1.5 rounded-full bg-linc-50 px-1.5 py-0.5 text-[10px] font-bold text-linc-700">
                {filterCount}
              </span>
            )}
          </span>
          <span className="text-[11px] font-medium text-neutral-400">
            Date and order
          </span>
        </summary>

        <form
          method="get"
          action="/search"
          className="grid gap-3 px-4 pb-4 sm:grid-cols-2"
        >
          <input type="hidden" name="q" value={q} />
          <input type="hidden" name="category" value={categoryId} />

          <div>
            <label htmlFor="sort" className="block text-[11px] font-semibold text-neutral-500">
              Order by
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={sort}
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-linc-400"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="from" className="block text-[11px] font-semibold text-neutral-500">
              From
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={fromValue}
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-linc-400"
            />
          </div>

          <div>
            <label htmlFor="to" className="block text-[11px] font-semibold text-neutral-500">
              To
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={toValue}
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-linc-400"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-full border border-line px-4 py-2 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
            >
              Apply filters
            </button>
          </div>
        </form>
      </details>

      {chips.length > 0 && (
        <div
          aria-label="Active filters"
          className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2.5"
        >
          {chips.map((chip) => (
            <Link
              key={chip.label}
              href={chip.href}
              aria-label={`Remove filter ${chip.label}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-linc-50 px-2.5 py-1 text-[12px] font-semibold text-linc-700 transition hover:bg-linc-100"
            >
              {chip.label}
              <span aria-hidden>×</span>
            </Link>
          ))}
          <Link
            href={hrefWithout("category", "from", "to", "sort")}
            className="px-1.5 py-1 text-[12px] font-semibold text-neutral-500 transition hover:text-ink"
          >
            Clear all
          </Link>
        </div>
      )}

      <SearchHistory q={q} qs={returnParams.toString()} />

      {q && matchedCategories.length > 0 && (
        <div aria-label="Matching categories" className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2.5">
          <span className="text-[12px] font-semibold text-neutral-500">Categories:</span>
          {matchedCategories.map((category) => (
            <Link
              key={category.id}
              href={`/c/${category.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-linc-50 px-2.5 py-1 text-[12px] font-semibold text-linc-700 transition hover:bg-linc-100"
            >
              {category.label}
              <span className="text-[11px] font-medium text-neutral-400">{category.total}</span>
            </Link>
          ))}
        </div>
      )}

      {q ? (
        <>
          <p className="border-b border-line px-4 py-2.5 text-[13px] text-neutral-500">
            <span className="font-semibold text-ink">{results.length}</span> result
            {results.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
            {sort !== "relevance" && (
              <span className="text-neutral-400">
                {" "}
                - {SORTS.find((option) => option.value === sort)?.label}
              </span>
            )}
          </p>
          {results.length === 0 ? (
            <>
              <EmptyState
                title="No matching posts"
                description="Try a shorter keyword, remove a filter, or search a different category. Only published entries are indexed."
                art="search"
              />
              {help?.suggestion && (
                <p className="border-t border-line px-4 py-3 text-[14px] text-neutral-600">
                  Did you mean{" "}
                  <Link
                    href={`/search?q=${encodeURIComponent(help.suggestion)}`}
                    className="font-semibold text-linc-700 hover:underline"
                  >
                    {help.suggestion}
                  </Link>
                  ?
                </p>
              )}
              {help && help.related.length > 0 && (
                <section className="border-t border-line" aria-label="Related posts">
                  <h2 className="px-4 pt-3 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
                    Related posts
                  </h2>
                  <ul className="divide-y divide-line">
                    {help.related.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={`/c/${item.category_slug}/${item.id}`}
                          className="block px-4 py-3 transition hover:bg-neutral-50/60"
                        >
                          <span className="block text-[14px] font-semibold text-ink">
                            {item.title}
                          </span>
                          <span className="text-[12px] text-neutral-500">{item.category_label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <div className="divide-y divide-line">
              {results.map((entry) => (
                <PostCard
                  key={entry.id}
                  entry={entry}
                  viewerId={session?.id}
                  returnTo={returnTo}
                  highlight={terms}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title="Find a post"
          description="Search across every published announcement, concern, policy clarification, and event post."
          art="search"
        />
      )}
    </div>
  );
}
