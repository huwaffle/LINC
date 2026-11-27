export const dynamic = "force-dynamic";

import Link from "next/link";
import { adminAttention, adminStats } from "@/lib/db/queries";

export default async function AdminOverviewPage() {
  const stats = await adminStats();
  const attention = await adminAttention();

  const cards = [
    { label: "Published", hint: "Live in the feed", value: stats.published, tone: "text-linc-700", href: "/admin/posts" },
    { label: "Pending review", hint: "Waiting on an administrator", value: stats.pending, tone: "text-amber-600", href: "/admin/posts" },
    { label: "Rejected", hint: "Returned to authors", value: stats.rejected, tone: "text-rose-600", href: "/admin/posts" },
    { label: "Removed", hint: "Taken off the feed", value: stats.redacted, tone: "text-neutral-600", href: "/admin/posts" },
    { label: "Open reports", hint: "Reported by users", value: stats.reports, tone: "text-rose-600", href: "/admin/outbox" },
    { label: "Safety flags", hint: "Flagged by scans", value: stats.safetyFlags, tone: "text-rose-600", href: "/admin/safety" },
    { label: "Anonymous posts", hint: "Pseudonymous authors", value: stats.anonymous, tone: "text-neutral-600", href: "/admin/posts" },
    { label: "Users", hint: "Registered accounts", value: stats.users, tone: "text-neutral-600", href: "/admin/users" },
  ];

  const breakdown = [
    { label: "Published", value: stats.published, bar: "bg-linc-600" },
    { label: "Pending", value: stats.pending, bar: "bg-amber-500" },
    { label: "Rejected", value: stats.rejected, bar: "bg-rose-500" },
    { label: "Removed", value: stats.redacted, bar: "bg-neutral-400" },
  ];
  const total = breakdown.reduce((sum, item) => sum + item.value, 0);

  const actions = [
    { label: "Review posts", count: attention.pending, href: "/admin/posts" },
    { label: "Check safety flags", count: attention.safety, href: "/admin/safety" },
    { label: "Read outbox", count: attention.outbox, href: "/admin/outbox" },
  ];

  return (
    <div>
      <div className="px-4 py-4">
        <h1 className="text-[19px] font-bold tracking-[-0.02em] text-ink">Overview</h1>
        <p className="text-[13px] text-neutral-500">A quick look at what needs you today.</p>
      </div>

      <div className="grid grid-cols-2 gap-px border-y border-line bg-line sm:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white px-4 py-5 transition hover:bg-neutral-50"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              {card.label}
            </p>
            <p className={`mt-2 text-[30px] font-bold leading-none tracking-[-0.02em] ${card.tone}`}>
              {card.value}
            </p>
            <p className="mt-2 text-[12px] text-neutral-500">{card.hint}</p>
          </Link>
        ))}
      </div>

      <section className="px-4 py-5">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
          Post status
        </h2>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-neutral-100">
          {total > 0 &&
            breakdown.map((item) =>
              item.value > 0 ? (
                <div
                  key={item.label}
                  className={item.bar}
                  style={{ width: `${(item.value / total) * 100}%` }}
                  title={`${item.label}: ${item.value}`}
                />
              ) : null,
            )}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-neutral-600">
          {breakdown.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${item.bar}`} />
              {item.label}
              <span className="font-semibold text-ink">{item.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-line px-4 py-5">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
          Needs attention
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center justify-between gap-2 rounded-xl border border-line px-3.5 py-3 text-[13px] font-semibold text-ink transition hover:bg-neutral-50"
            >
              {action.label}
              <span
                className={`min-w-[22px] rounded-full px-1.5 text-center text-[11px] font-bold leading-[22px] ${
                  action.count > 0 ? "bg-rose-600 text-white" : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {action.count}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
