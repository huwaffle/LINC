export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/linc/page-header";
import { ChartIcon, DownloadIcon } from "@/components/linc/icons";
import { adminInsights } from "@/lib/db/queries";

const STATUS_TONE: Record<string, string> = {
  draft: "bg-neutral-300",
  pending: "bg-amber-400",
  published: "bg-linc-600",
  rejected: "bg-rose-400",
  redacted: "bg-neutral-500",
};

function Bar({
  label,
  value,
  max,
  hint,
}: {
  label: string;
  value: number;
  max: number;
  hint?: string;
}) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[12px] font-medium text-ink">{label}</span>
        <span className="text-[11px] tabular-nums text-neutral-500">{hint ?? value}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-linc-500" style={{ width: `${width}%` }} />
      </div>
    </li>
  );
}

export default async function AdminInsightsPage() {
  const insights = await adminInsights();
  const maxCategory = Math.max(1, ...insights.byCategory.map((row) => row.count));
  const maxWeek = Math.max(1, ...insights.weekly.map((row) => row.count));
  const maxEvent = Math.max(1, ...insights.topEvents.map((row) => row.rsvp_count));
  const totalReactions =
    insights.reactions.likes +
    insights.reactions.comments +
    insights.reactions.reposts +
    insights.reactions.saves;
  const statusTotal = insights.status.reduce((sum, row) => sum + row.count, 0) || 1;

  const cards = [
    { label: "Moderation decisions", value: String(insights.decisions) },
    {
      label: "Avg. decision time",
      value: insights.avgDecisionHours === null ? "n/a" : `${insights.avgDecisionHours}h`,
    },
    { label: "Event attendees (going)", value: String(insights.rsvps) },
    { label: "Social reactions", value: String(totalReactions) },
  ];

  return (
    <div>
      <PageHeader
        title="Insights"
        subtitle="Local evaluation data"
        actions={
          <Link
            href="/admin"
            className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
          >
            Overview
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              {card.label}
            </p>
            <p className="mt-1 text-[22px] font-bold leading-none tracking-[-0.02em] text-ink">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <section className="border-b border-line px-4 py-4">
        <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
          <ChartIcon className="h-4 w-4" />
          Posts by category
        </h2>
        <ul className="mt-3 space-y-2.5">
          {insights.byCategory.map((row) => (
            <Bar
              key={row.label}
              label={row.label}
              value={row.count}
              max={maxCategory}
              hint={`${row.count} total (${row.published} live)`}
            />
          ))}
        </ul>
      </section>

      <section className="border-b border-line px-4 py-4">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
          New posts per week
        </h2>
        <div className="mt-3 flex items-end gap-2">
          {insights.weekly.map((row) => {
            const height = Math.max(3, Math.round((row.count / maxWeek) * 88));
            return (
              <div key={row.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold tabular-nums text-neutral-500">
                  {row.count}
                </span>
                <div
                  className="w-full rounded-t bg-linc-500"
                  style={{ height: `${height}px` }}
                  title={`${row.label}: ${row.count} posts`}
                />
                <span className="truncate text-[9px] text-neutral-400">{row.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-b border-line px-4 py-4">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
          Status mix
        </h2>
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-neutral-100">
          {insights.status.map((row) => (
            <div
              key={row.label}
              className={STATUS_TONE[row.label] ?? "bg-neutral-300"}
              style={{ width: `${(row.count / statusTotal) * 100}%` }}
              title={`${row.label}: ${row.count}`}
            />
          ))}
        </div>
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
          {insights.status.map((row) => (
            <li key={row.label} className="flex items-center gap-1.5 text-[11px] text-neutral-600">
              <span className={`h-2 w-2 rounded-full ${STATUS_TONE[row.label] ?? "bg-neutral-300"}`} />
              <span className="capitalize">{row.label === "redacted" ? "removed" : row.label}</span>
              <span className="font-semibold tabular-nums text-ink">{row.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-b border-line px-4 py-4">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
          Most joined events
        </h2>
        {insights.topEvents.length === 0 ? (
          <p className="mt-2 text-[13px] text-neutral-500">No events have been published yet.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {insights.topEvents.map((row) => (
              <Bar
                key={row.title}
                label={row.title}
                value={row.rsvp_count}
                max={maxEvent}
                hint={`${row.rsvp_count} going`}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="px-4 py-4">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
          Social reactions
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Likes", value: insights.reactions.likes },
            { label: "Comments", value: insights.reactions.comments },
            { label: "Reposts", value: insights.reactions.reposts },
            { label: "Saves", value: insights.reactions.saves },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-line px-3 py-2.5">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                {item.label}
              </dt>
              <dd className="mt-0.5 text-[18px] font-bold leading-none text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-line px-4 py-4">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
          Export for the evaluation chapter
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">
          CSV files open in Excel or Sheets. They are generated from the Supabase database and
          downloaded directly by your browser.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { dataset: "entries", label: "Entries" },
            { dataset: "reports", label: "Reports" },
            { dataset: "moderation", label: "Moderation log" },
          ].map((item) => (
            <a
              key={item.dataset}
              href={`/api/admin/export/${item.dataset}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-neutral-50"
            >
              <DownloadIcon className="h-4 w-4" />
              {item.label} CSV
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
