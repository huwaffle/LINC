export const dynamic = "force-dynamic";

import Link from "next/link";
import { addSafetyTerm, removeSafetyTerm, resolveSafetyFlag, runSafetyScan } from "@/app/actions/safety";
import { EmptyState, Notice } from "@/components/linc/empty-state";
import { SafetyScanButton } from "@/components/linc/safety-scan-button";
import { requireRole } from "@/lib/auth/session";
import {
  getLastSafetyScan,
  getSafetyStats,
  listSafetyFlags,
  type SafetyFlagRecord,
} from "@/lib/db/queries";
import { formatDateTime, formatRelative } from "@/lib/format";
import { safetyConfig } from "@/lib/moderation/config";
import { listBuiltInGroups } from "@/lib/moderation/lexicon";
import { GEMINI_MODEL, isGeminiConfigured } from "@/lib/moderation/gemini";
import { listSafetyTerms, type SafetyTermRecord } from "@/lib/moderation/terms";
import { messageFrom } from "@/lib/redirects";

const STATUSES = ["open", "reviewed", "dismissed", "all"] as const;
type StatusFilter = (typeof STATUSES)[number];

const SEVERITY_STYLE: Record<SafetyFlagRecord["severity"], string> = {
  high: "border-rose-200 bg-rose-50 text-rose-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-neutral-200 bg-neutral-50 text-neutral-600",
};

const TERM_SEVERITY_STYLE: Record<SafetyTermRecord["severity"], string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-neutral-100 text-neutral-600",
};

const inputClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-linc-400";
const labelClass = "mb-1 block text-[11px] font-semibold text-neutral-500";

function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function targetHref(flag: SafetyFlagRecord): string | null {
  if (flag.target_type === "entry") {
    return flag.category_slug ? `/c/${flag.category_slug}/${flag.target_id}` : null;
  }
  if (flag.target_type === "comment") {
    return flag.comment_entry_slug && flag.comment_entry_id
      ? `/c/${flag.comment_entry_slug}/${flag.comment_entry_id}#comment-${flag.target_id}`
      : null;
  }
  return flag.account_username ? `/u/${flag.account_username}` : null;
}

export default async function SafetyPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; notice?: string; error?: string }>;
}) {
  await requireRole("admin");
  const sp = await searchParams;
  const status: StatusFilter = STATUSES.find((value) => value === sp.status) ?? "open";
  const flags = await listSafetyFlags({ status, limit: 200 });
  const stats = await getSafetyStats();
  const lastScan = await getLastSafetyScan();
  const terms = await listSafetyTerms();
  const builtIn = listBuiltInGroups();
  const showWords = typeof sp.notice === "string" && sp.notice.toLowerCase().includes("filter");
  const gemini = isGeminiConfigured();
  const config = safetyConfig();
  const notice = messageFrom({
    error: typeof sp.error === "string" ? sp.error : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });

  const tab = (value: StatusFilter, label: string) => (
    <Link
      key={value}
      href={value === "open" ? "/admin/safety" : `/admin/safety?status=${value}`}
      aria-current={status === value ? "page" : undefined}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold capitalize transition ${
        status === value
          ? "bg-ink text-white"
          : "text-neutral-500 hover:bg-neutral-100 hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
        <div>
          <h1 className="text-[19px] font-bold tracking-[-0.02em] text-ink">Content safety</h1>
          <p className="max-w-xl text-[13px] leading-relaxed text-neutral-500">
            Gemini reviews posts, comments, and account names for profanity, slurs, harassment,
            and threats, including the offensive words you add below. Findings appear here;
            alerts are sent to the admin outbox for {config.notifyMinSeverity} risk and above.
          </p>
        </div>
        <form action={runSafetyScan}>
          <SafetyScanButton />
        </form>
      </div>

      {!gemini && (
        <Notice kind="info">
          <strong>Gemini is not configured.</strong> Scans still run with the offline lexicon.
          Add <code>GEMINI_API_KEY</code> to <code>.env.local</code> and restart the server to enable
          contextual analysis.
        </Notice>
      )}

      {notice.text && (
        <Notice kind={notice.kind === "error" ? "error" : "success"}>{notice.text}</Notice>
      )}

      <section aria-labelledby="word-filters" className="border-b border-line bg-white px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="word-filters" className="text-[14px] font-bold text-ink">
              Offensive word filters
            </h2>
            <p className="mt-0.5 max-w-xl text-[12px] leading-relaxed text-neutral-500">
              Add words or short phrases that Gemini and the offline scanner must always treat
              as offensive. Adding an existing word updates its severity. Filters apply to new
              scans; run <strong>Scan all posts, comments &amp; accounts</strong> to re-check
              existing content.
            </p>
          </div>
          <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            {terms.length} filter{terms.length === 1 ? "" : "s"}
          </span>
        </div>

        <form action={addSafetyTerm} className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <label htmlFor="term" className={labelClass}>
              Word or phrase
            </label>
            <input
              id="term"
              name="term"
              required
              maxLength={60}
              placeholder="e.g. putangina"
              className={inputClass}
            />
          </div>
          <div className="w-[110px]">
            <label htmlFor="severity" className={labelClass}>
              Severity
            </label>
            <select id="severity" name="severity" defaultValue="medium" className={inputClass}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-full bg-linc-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-linc-700"
          >
            Add filter
          </button>
        </form>

        <details className="group mt-3" open={showWords}>
          <summary className="inline-flex cursor-pointer list-none items-center rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink transition hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">See all filtered words</span>
            <span className="hidden group-open:inline">Hide filtered words</span>
          </summary>

          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
                Added by admin ({terms.length})
              </h3>
              {terms.length === 0 ? (
                <p className="mt-1.5 text-[12px] text-neutral-500">None added yet.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {terms.map((term) => (
                    <li
                      key={term.id}
                      className="flex items-center gap-1.5 rounded-full border border-line bg-canvas py-0.5 pl-2.5 pr-1"
                    >
                      <span className="text-[12px] font-medium text-ink">{term.term}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${TERM_SEVERITY_STYLE[term.severity]}`}
                      >
                        {term.severity}
                      </span>
                      <form action={removeSafetyTerm}>
                        <input type="hidden" name="id" value={term.id} />
                        <button
                          type="submit"
                          aria-label={`Remove ${term.term}`}
                          title={`Remove ${term.term}`}
                          className="rounded-full px-1.5 text-[14px] leading-none text-neutral-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          ×
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
                Built-in ({builtIn.reduce((sum, group) => sum + group.terms.length, 0)})
              </h3>
              <div className="mt-2 space-y-3">
                {builtIn.map((group) => (
                  <div key={`${group.severity}-${group.category}`}>
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold capitalize text-ink">
                      {group.category}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${TERM_SEVERITY_STYLE[group.severity]}`}
                      >
                        {group.severity}
                      </span>
                    </p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {group.terms.map((word) => (
                        <li
                          key={word}
                          className="rounded-full border border-line bg-canvas px-2.5 py-0.5 text-[12px] font-medium text-ink"
                        >
                          {word}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </details>
      </section>

      <div className="grid grid-cols-2 gap-px border-y border-line bg-line sm:grid-cols-4">
        {[
          { label: "Open flags", value: stats.open, tone: "text-rose-600" },
          { label: "High risk", value: stats.high, tone: "text-rose-600" },
          { label: "Medium risk", value: stats.medium, tone: "text-amber-600" },
          { label: "Low risk", value: stats.low, tone: "text-neutral-600" },
        ].map((card) => (
          <div key={card.label} className="bg-white px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              {card.label}
            </p>
            <p className={`mt-1 text-[22px] font-bold leading-none tracking-[-0.02em] ${card.tone}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <p className="border-b border-line bg-canvas px-4 py-2.5 text-[12px] leading-relaxed text-neutral-600">
        {lastScan ? (
          <>
            Last scan: {formatDateTime(lastScan.created_at)} · {lastScan.scanned_count} items ·{" "}
            {lastScan.flagged_count} flagged · {lastScan.notified_count} alerted ·{" "}
            {lastScan.provider === "gemini" ? `Gemini (${GEMINI_MODEL})` : "offline lexicon"}
          </>
        ) : (
          <>No scan has run yet. Automatic scans run when a post or comment is submitted, or an account changes.</>
        )}
        {gemini ? (
          <> · Gemini model: <code className="rounded bg-white px-1 py-0.5">{GEMINI_MODEL}</code></>
        ) : null}
      </p>

      <nav
        aria-label="Filter safety flags"
        className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-3 py-2"
      >
        {tab("open", "Open")}
        {tab("reviewed", "Reviewed")}
        {tab("dismissed", "Dismissed")}
        {tab("all", "All")}
      </nav>

      {flags.length === 0 ? (
        <EmptyState
          title={status === "open" ? "No open safety flags" : "Nothing in this filter"}
          description={
            status === "open"
              ? "Run a scan to review existing posts, comments, and accounts, or wait for an automatic scan after a submission."
              : "Flags you review or dismiss are kept here for the audit trail."
          }
          art="receipt"
        />
      ) : (
        <ul className="divide-y divide-line">
          {flags.map((flag) => {
            const categories = parseList(flag.categories);
            const terms = parseList(flag.matched_terms);
            const href = targetHref(flag);
            const label =
              flag.target_type === "entry"
                ? flag.entry_title ?? flag.target_label
                : flag.target_type === "comment"
                  ? flag.comment_entry_title
                    ? `Comment on "${flag.comment_entry_title}"`
                    : flag.target_label
                  : flag.target_label;

            return (
              <li key={flag.id} className="px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span
                    className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide ${SEVERITY_STYLE[flag.severity]}`}
                  >
                    {flag.severity} risk
                  </span>
                  <span className="rounded-full border border-line px-2 py-0.5 font-semibold capitalize text-neutral-500">
                    {flag.target_type}
                  </span>
                  <span className="rounded-full border border-line px-2 py-0.5 font-semibold capitalize text-neutral-500">
                    {flag.status}
                  </span>
                  <span className="text-neutral-400">{formatRelative(flag.updated_at)}</span>
                  <span className="text-neutral-400">
                    {flag.provider === "gemini" ? "Gemini" : "Offline lexicon"}
                  </span>
                </div>

                <p className="mt-1 text-[14px] font-semibold text-ink">
                  {href ? (
                    <Link href={href} className="hover:underline">
                      {label}
                    </Link>
                  ) : (
                    label
                  )}
                </p>

                {categories.length > 0 || terms.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {categories.map((category) => (
                      <span
                        key={`category-${category}`}
                        className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600"
                      >
                        {category}
                      </span>
                    ))}
                    {terms.map((term) => (
                      <span
                        key={`term-${term}`}
                        className="rounded-full border border-line px-2 py-0.5 text-[10px] font-medium text-neutral-600"
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                ) : null}

                <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">
                  {flag.excerpt}
                </p>
                {flag.explanation && (
                  <p className="mt-0.5 text-[12px] italic leading-relaxed text-neutral-500">
                    {flag.explanation}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
                  {flag.target_type === "entry" && (
                    <Link
                      href="/admin/posts"
                      className="font-semibold text-linc-700 hover:underline"
                    >
                      Review post
                    </Link>
                  )}
                  {flag.status === "open" ? (
                    <>
                      <form action={resolveSafetyFlag}>
                        <input type="hidden" name="flagId" value={flag.id} />
                        <input type="hidden" name="status" value="reviewed" />
                        <button
                          type="submit"
                          className="font-semibold text-linc-700 hover:underline"
                        >
                          Mark reviewed
                        </button>
                      </form>
                      <form action={resolveSafetyFlag}>
                        <input type="hidden" name="flagId" value={flag.id} />
                        <input type="hidden" name="status" value="dismissed" />
                        <button
                          type="submit"
                          className="font-semibold text-neutral-500 hover:underline"
                        >
                          Dismiss
                        </button>
                      </form>
                    </>
                  ) : (
                    <span className="text-neutral-400">
                      {flag.status === "reviewed" ? "Reviewed" : "Dismissed"}
                      {flag.reviewed_at ? ` ${formatDateTime(flag.reviewed_at)}` : ""}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
