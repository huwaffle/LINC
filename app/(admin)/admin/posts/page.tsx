export const dynamic = "force-dynamic";

import Link from "next/link";
import { moderateEntry } from "@/app/actions/moderation";
import { EmptyState, Notice } from "@/components/linc/empty-state";
import { PostCard } from "@/components/linc/post-card";
import { requireRole } from "@/lib/auth/session";
import { categoryChipStyle, categoryColor } from "@/lib/category-colors";
import {
  attachViewerState,
  getEntry,
  listAllEntries,
  listCategories,
  listEntryReports,
} from "@/lib/db/queries";
import { messageFrom } from "@/lib/redirects";

const STATUSES = ["pending", "published", "rejected", "redacted"] as const;

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    category?: string;
    q?: string;
    cursor?: string;
    review?: string;
    notice?: string;
    error?: string;
  }>;
}) {
  const session = await requireRole("admin");
  const sp = await searchParams;
  const categories = await listCategories();
  const status = STATUSES.find((s) => s === sp.status);
  const category = categories.find((c) => c.slug === sp.category)?.slug;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const { items, nextCursor } = await listAllEntries({
    status,
    category,
    q,
    cursor: typeof sp.cursor === "string" ? sp.cursor : null,
  });
  await attachViewerState(items, session.id);

  const reviewed = sp.review ? await getEntry(sp.review) : undefined;
  if (reviewed) await attachViewerState([reviewed], session.id);
  const reports = reviewed ? await listEntryReports(reviewed.id) : [];
  const message = messageFrom({
    error: typeof sp.error === "string" ? sp.error : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });

  const href = (next: { status?: string; category?: string; cursor?: string }) => {
    const params = new URLSearchParams();
    const merged = { status, category, ...next };
    if (merged.status) params.set("status", merged.status);
    if (merged.category) params.set("category", merged.category);
    if (q) params.set("q", q);
    if (merged.cursor) params.set("cursor", merged.cursor);
    const query = params.toString();
    return `/admin/posts${query ? `?${query}` : ""}`;
  };

  const reviewHref = (entryId: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (q) params.set("q", q);
    params.set("review", entryId);
    return `/admin/posts?${params}`;
  };

  const pill = (active: boolean, to: string, label: string, key: string) => (
    <Link
      key={key}
      href={to}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold capitalize transition ${
        active ? "bg-ink text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div>
      <div className="px-4 py-4">
        <h1 className="text-[19px] font-bold tracking-[-0.02em] text-ink">All posts</h1>
      </div>

      {message.text && (
        <div className="px-4 pb-3">
          <Notice kind={message.kind === "error" ? "error" : "success"}>{message.text}</Notice>
        </div>
      )}

      {reviewed && (
        <section aria-label="Moderation review" className="border-b-4 border-line bg-canvas px-4 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-bold text-ink">Review this post</h2>
            <Link href={href({})} className="text-[13px] font-semibold text-neutral-500 hover:text-ink">
              Close
            </Link>
          </div>

          <div className="rounded-2xl border border-line bg-white">
            <PostCard entry={reviewed} showStatus viewerId={session.id} returnTo={href({})} />
          </div>

          {reports.length > 0 && (
            <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
              <p className="text-[12px] font-bold uppercase tracking-wide text-rose-700">Reported by users</p>
              <ul className="mt-1 space-y-1">
                {reports.map((report) => (
                  <li key={report.id} className="text-[13px] text-rose-800">
                    <span className="font-semibold">{report.reporter_name}</span>: {report.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form action={moderateEntry} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="entryId" value={reviewed.id} />
            <label htmlFor="moderation-reason" className="text-[12px] font-semibold text-neutral-600">
              Reason shown to the author
            </label>
            <textarea
              id="moderation-reason"
              name="reason"
              required
              rows={2}
              placeholder="Reason shown to the author"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-linc-400"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                name="action"
                value="publish"
                formNoValidate
                className="rounded-full bg-linc-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-linc-700"
              >
                Publish entry
              </button>
              {reviewed.status !== "published" && (
                <button
                  type="submit"
                  name="action"
                  value="reject"
                  className="rounded-full border border-rose-200 px-4 py-2 text-[13px] font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  Reject with reason
                </button>
              )}
              {reviewed.status === "published" && (
                <button
                  type="submit"
                  name="action"
                  value="redact"
                  className="rounded-full border border-rose-200 px-4 py-2 text-[13px] font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  Remove with reason
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      <form action="/admin/posts" className="flex gap-2 px-4 pb-3">
        {status && <input type="hidden" name="status" value={status} />}
        {category && <input type="hidden" name="category" value={category} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search posts by title, text or author"
          aria-label="Search posts"
          className="min-w-0 flex-1 rounded-full border border-line px-4 py-2 text-[14px] text-ink placeholder:text-neutral-400 outline-none transition focus:border-linc-400 focus:ring-4 focus:ring-linc-50"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
        >
          Search
        </button>
        {q && (
          <Link
            href={`/admin/posts?${new URLSearchParams({ ...(status && { status }), ...(category && { category }) })}`}
            className="grid shrink-0 place-items-center rounded-full border border-line px-3.5 text-[13px] font-semibold text-ink transition hover:bg-neutral-50"
          >
            Clear
          </Link>
        )}
      </form>

      <nav aria-label="Filter by status" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2">
        {pill(!status, href({ status: undefined }), "All", "all")}
        {STATUSES.map((s) => pill(status === s, href({ status: s }), s === "redacted" ? "removed" : s, s))}
      </nav>

      <nav aria-label="Filter by category" className="flex flex-wrap gap-1 border-b border-line px-3 pb-3">
        {pill(!category, href({ category: undefined }), "All categories", "all-cat")}
        {categories.map((c) => {
          const active = category === c.slug;
          return (
            <Link
              key={c.slug}
              href={href({ category: c.slug })}
              aria-current={active ? "page" : undefined}
              className="shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition hover:opacity-80"
              style={
                active
                  ? { backgroundColor: categoryColor(c.slug), borderColor: categoryColor(c.slug), color: "#fff" }
                  : categoryChipStyle(c.slug)
              }
            >
              {c.label}
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <EmptyState title="No posts" description="Nothing matches this filter." />
      ) : (
        <div className="divide-y divide-line">
          {items.map((entry) => (
            <div key={entry.id}>
              <PostCard entry={entry} showStatus viewerId={session.id} returnTo={href({})} />
              <div className="px-4 pb-3 pl-[3.75rem] text-[12px]">
                <Link
                  href={reviewHref(entry.id)}
                  className="font-semibold text-linc-700 hover:underline"
                >
                  Review
                </Link>
                {entry.status !== "draft" && (
                  <Link
                    href={`/c/${entry.category_slug}/${entry.id}/edit`}
                    className="ml-3 font-semibold text-linc-700 hover:underline"
                  >
                    Edit
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {nextCursor && (
        <div className="flex justify-center px-4 py-5">
          <Link
            href={href({ cursor: nextCursor })}
            className="rounded-full border border-line px-5 py-2 text-[13px] font-semibold text-ink transition hover:bg-neutral-50"
          >
            Older posts
          </Link>
        </div>
      )}
    </div>
  );
}
