export const dynamic = "force-dynamic";

import { createAd, deleteAd, toggleAd } from "@/app/actions/ads";
import { EmptyState, Notice } from "@/components/linc/empty-state";
import { adState, listAds } from "@/lib/db/ads";
import { formatDateTime } from "@/lib/format";
import { messageFrom } from "@/lib/redirects";

const inputClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-linc-400";
const labelClass = "mb-1 block text-[11px] font-semibold text-neutral-500";

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const ads = await listAds();
  const notice = messageFrom({
    error: typeof sp.error === "string" ? sp.error : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });

  return (
    <div>
      <div className="px-4 py-4">
        <h1 className="text-[19px] font-bold tracking-[-0.02em] text-ink">Advertisements</h1>
        <p className="text-[13px] leading-relaxed text-neutral-500">
          Active ads appear as labelled &ldquo;Sponsored&rdquo; cards in the home feed and the side panel.
        </p>
      </div>

      {notice.text && (
        <Notice kind={notice.kind === "error" ? "error" : "success"}>{notice.text}</Notice>
      )}

      <form
        action={createAd}
        className="grid gap-3 border-y border-line px-4 py-4 sm:grid-cols-2"
      >
        <div>
          <label htmlFor="title" className={labelClass}>Headline</label>
          <input id="title" name="title" maxLength={80} required className={inputClass} />
        </div>
        <div>
          <label htmlFor="sponsor" className={labelClass}>Sponsor</label>
          <input id="sponsor" name="sponsor" maxLength={60} required className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="body" className={labelClass}>Description (optional)</label>
          <textarea id="body" name="body" maxLength={240} rows={2} className={inputClass} />
        </div>
        <div>
          <label htmlFor="link" className={labelClass}>Link</label>
          <input id="link" name="link" type="url" placeholder="https://" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="image" className={labelClass}>Image (optional, max 5 MB)</label>
          <input
            id="image"
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="w-full text-[12px] text-neutral-500"
          />
        </div>
        <div>
          <label htmlFor="startsAt" className={labelClass}>Start date (optional)</label>
          <input id="startsAt" name="startsAt" type="date" className={inputClass} />
        </div>
        <div>
          <label htmlFor="endsAt" className={labelClass}>End date (optional)</label>
          <input id="endsAt" name="endsAt" type="date" className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-full bg-linc-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-linc-700"
          >
            Publish advertisement
          </button>
        </div>
      </form>

      {ads.length === 0 ? (
        <EmptyState
          title="No advertisements yet"
          description="Create one above and it will start showing to everyone right away."
          art="search"
        />
      ) : (
        <ul className="divide-y divide-line">
          {ads.map((ad) => (
            <li key={ad.id} className="flex gap-3 px-4 py-3.5">
              {ad.image_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/ads/${ad.id}/image`}
                  alt=""
                  className="h-16 w-24 shrink-0 rounded-lg border border-line object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      adState(ad) === "active" ? "bg-linc-600 text-white" : "border border-line text-neutral-500"
                    }`}
                  >
                    {adState(ad)}
                  </span>
                  <span className="text-neutral-400">{ad.sponsor} · {formatDateTime(ad.created_at)}</span>
                </div>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {ad.impressions} views · {ad.clicks} clicks ·{" "}
                  {ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : "0.0"}% CTR
                  {(ad.starts_at !== null || ad.ends_at !== null) && (
                    <>
                      {" "}· runs {ad.starts_at !== null ? formatDateTime(ad.starts_at) : "now"} to{" "}
                      {ad.ends_at !== null ? formatDateTime(ad.ends_at) : "no end"}
                    </>
                  )}
                </p>
                <p className="mt-1 text-[14px] font-semibold text-ink">{ad.title}</p>
                {ad.body && <p className="text-[13px] text-neutral-600">{ad.body}</p>}
                <a
                  href={ad.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-[12px] font-semibold text-linc-700 hover:underline"
                >
                  {ad.link_url}
                </a>
                <div className="mt-2 flex gap-2">
                  <form action={toggleAd}>
                    <input type="hidden" name="id" value={ad.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
                    >
                      {ad.active ? "Pause" : "Resume"}
                    </button>
                  </form>
                  <form action={deleteAd}>
                    <input type="hidden" name="id" value={ad.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-rose-200 px-3 py-1 text-[12px] font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
