import Link from "next/link";
import { notFound } from "next/navigation";
import { updateEntry } from "@/app/actions/posts";
import { EmptyState, Notice } from "@/components/linc/empty-state";
import { PageHeader } from "@/components/linc/page-header";
import { requireUser } from "@/lib/auth/session";
import { getEntry, listCategories } from "@/lib/db/queries";
import { messageFrom } from "@/lib/redirects";

export default async function EditEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { category, id } = await params;
  const session = await requireUser(`/c/${category}/${id}/edit`);
  const sp = await searchParams;
  const entry = await getEntry(id);

  if (!entry || entry.category_slug !== category) notFound();

  const adminEdit = session.role === "admin" && entry.author_id !== session.id && entry.status !== "draft";
  const allowed = adminEdit || (entry.author_id === session.id && !entry.is_anonymous);
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Edit post" backHref={`/c/${category}/${id}`} backLabel="Back to post" />
        <EmptyState
          title="You cannot edit this post"
          description="Only the account that wrote a post can edit it, and anonymous posts stay detached from every account."
          art="locked"
        />
      </div>
    );
  }

  const categories = await listCategories();
  const message = messageFrom({
    error: typeof sp.error === "string" ? sp.error : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });
  const reReview = !adminEdit && entry.status !== "draft" && entry.status !== "pending";

  return (
    <div>
      <PageHeader title="Edit post" backHref={`/c/${category}/${id}`} backLabel="Back to post" />

      {message.text && (
        <Notice kind={message.kind === "error" ? "error" : "success"}>{message.text}</Notice>
      )}

      {adminEdit && (
        <p className="border-b border-line bg-linc-50 px-4 py-2.5 text-[12px] leading-relaxed text-linc-700">
          You are editing this post as an administrator. It keeps its current status and the author is notified.
        </p>
      )}

      {reReview && (
        <p className="border-b border-line bg-amber-50 px-4 py-2.5 text-[12px] leading-relaxed text-amber-800">
          Saving changes returns this post to the admin queue for review.
        </p>
      )}

      <form action={updateEntry} className="px-4 py-4">
        <input type="hidden" name="entryId" value={entry.id} />

        <label htmlFor="title" className="block text-[11px] font-semibold text-neutral-500">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={entry.title}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[18px] font-semibold text-ink outline-none transition focus:border-linc-400 focus:ring-4 focus:ring-linc-50"
        />

        <label htmlFor="body" className="mt-4 block text-[11px] font-semibold text-neutral-500">
          Details
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={10}
          defaultValue={entry.body}
          className="mt-1 w-full resize-y rounded-xl border border-line bg-white px-3 py-2 text-[15px] leading-[1.55] text-ink outline-none transition focus:border-linc-400 focus:ring-4 focus:ring-linc-50"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <div className="min-w-[180px] flex-1">
            <label htmlFor="categoryId" className="block text-[11px] font-semibold text-neutral-500">
              Category
            </label>
            <select
              id="categoryId"
              name="categoryId"
              required
              defaultValue={entry.category_id}
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-linc-400"
            >
              {categories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
          <Link
            href={`/c/${category}/${id}`}
            className="text-[13px] font-semibold text-neutral-500 transition hover:text-ink"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-full bg-linc-600 px-5 py-2 text-[14px] font-semibold text-white transition hover:bg-linc-700"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
