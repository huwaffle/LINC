export const dynamic = "force-dynamic";

import Link from "next/link";
import { EmptyState } from "@/components/linc/empty-state";
import { PageHeader } from "@/components/linc/page-header";
import { LoadMore } from "@/components/linc/load-more";
import { PostCard } from "@/components/linc/post-card";
import { requireUser } from "@/lib/auth/session";
import { attachViewerState, countSavedEntries, listSavedEntries } from "@/lib/db/queries";

export default async function SavedPage() {
  const session = await requireUser("/saved");
  const { items: entries, nextCursor } = await listSavedEntries(session.id);
  const total = await countSavedEntries(session.id);
  await attachViewerState(entries, session.id);

  return (
    <div>
      <PageHeader
        title="Saved"
        subtitle={`${total} ${total === 1 ? "post" : "posts"}`}
        actions={
          <Link
            href="/"
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-ink"
          >
            Feed
          </Link>
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          title="No saved posts"
          description="Tap the bookmark on any post to keep it here for later."
          art="saved"
          action={
            <Link
              href="/"
              className="inline-flex rounded-full bg-linc-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-linc-700"
            >
              Browse the feed
            </Link>
          }
        />
      ) : (
        <div className="divide-y divide-line">
          <LoadMore source="saved" initialCursor={nextCursor}>
            {entries.map((entry) => (
              <PostCard
                key={entry.id}
                entry={entry}
                viewerId={session.id}
                returnTo="/saved"
              />
            ))}
          </LoadMore>
        </div>
      )}
    </div>
  );
}
