import { pickAd, recordImpression, type AdRecord } from "@/lib/db/ads";

/** Show an ad after every Nth post in a feed (index is zero-based). */
export const FEED_AD_EVERY = 4;

export function feedAd(index: number) {
  return (index + 1) % FEED_AD_EVERY === 0 ? <AdCard className="bg-neutral-50/60" /> : null;
}

/** A clearly labelled sponsored card. Renders nothing when no ad is active. */
export async function AdCard({ ad: initialAd, className = "" }: { ad?: AdRecord; className?: string }) {
  const ad = initialAd ?? (await pickAd());
  if (!ad) return null;
  await recordImpression(ad.id);

  return (
    <aside aria-label="Advertisement" className={className}>
      <a
        href={`/api/ads/${ad.id}/click`}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className="block overflow-hidden transition hover:bg-neutral-50/70"
      >
        {ad.image_path && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/ads/${ad.id}/image`} alt="" className="max-h-56 w-full object-cover" />
        )}
        <span className="block px-4 py-3">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
            <span className="rounded bg-neutral-100 px-1.5 py-0.5">Sponsored</span>
            <span className="truncate normal-case tracking-normal">{ad.sponsor}</span>
          </span>
          <span className="mt-1 block text-[14px] font-semibold text-ink">{ad.title}</span>
          {ad.body && (
            <span className="mt-0.5 block text-[13px] leading-relaxed text-neutral-500">{ad.body}</span>
          )}
        </span>
      </a>
    </aside>
  );
}
