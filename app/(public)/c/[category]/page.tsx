import { Fragment } from "react";
import Link from "next/link";
import { feedAd } from "@/components/linc/ad-card";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/linc/page-header";
import { LoadMore } from "@/components/linc/load-more";
import { PostCard } from "@/components/linc/post-card";
import { EmptyState } from "@/components/linc/empty-state";
import { getSession } from "@/lib/auth/session";
import { attachViewerState, getCategoryBySlug, listPublishedEntries } from "@/lib/db/queries";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const session = await getSession();
  const { items: entries, nextCursor } = await listPublishedEntries({ categorySlug: slug });
  await attachViewerState(entries, session?.id);

  return (
    <div>
      <PageHeader
        title={category.label}
        subtitle={`${category.total} ${category.total === 1 ? "post" : "posts"}`}
        backHref="/"
        backLabel="Back to feed"
      />

      <p className="border-b border-line px-4 py-3 text-[13px] leading-relaxed text-neutral-500">
        {category.description}
      </p>

      {entries.length === 0 ? (
        <EmptyState
          title="No published entries"
          description="Submissions in this category are still waiting for administrator review."
        />
      ) : (
        <div className="divide-y divide-line">
          <LoadMore source="category" param={slug} initialCursor={nextCursor}>
            {entries.map((entry, index) => (
              <Fragment key={entry.id}>
                <PostCard entry={entry} viewerId={session?.id} returnTo={`/c/${slug}`} />
                {feedAd(index)}
              </Fragment>
            ))}
          </LoadMore>
        </div>
      )}
    </div>
  );
}
