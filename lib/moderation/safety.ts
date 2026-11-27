import { createHash } from "node:crypto";
import { after } from "next/server";
import { sqlite } from "../db/client";
import { newId } from "../db/users";
import { excerpt } from "../format";
import { meetsSeverity, safetyConfig } from "./config";
import { GEMINI_MODEL, assessWithGemini, chunks, isGeminiConfigured } from "./gemini";
import { normalizeForScan, scanAdminTerms, scanWithLexicon, type LexiconRule } from "./lexicon";
import { listSafetyRules } from "./terms";
import {
  mergeAssessments,
  severityRank,
  type SafetyAssessment,
  type SafetyItem,
  type SafetySeverity,
  type SafetyTarget,
} from "./types";

type EntryRow = {
  id: string;
  title: string;
  body: string;
  author_id: string;
  is_anonymous: number;
  status: string;
};

type AccountRow = {
  id: string;
  username: string;
  display_name: string;
};

type CommentRow = {
  id: string;
  entry_id: string;
  author_id: string;
  body: string;
  is_anonymous: number;
  entry_title: string;
};

type ExistingFlag = {
  id: string;
  severity: SafetySeverity;
  status: string;
  content_hash: string;
  reviewed_by: string | null;
  reviewed_at: number | null;
};

export type SafetyScanResult = {
  targetType: SafetyTarget;
  targetId: string;
  label: string;
  severity: SafetySeverity;
  flagged: boolean;
  created: boolean;
  reopened: boolean;
  provider: string;
};

export type FullScanResult = {
  scannedEntries: number;
  scannedComments: number;
  scannedAccounts: number;
  /** Every finding at or above the flag threshold. */
  flagged: number;
  /** Findings severe enough to notify the administrator. */
  noteworthy: number;
  created: number;
  reopened: number;
  provider: "gemini" | "local";
  geminiConfigured: boolean;
  model: string;
};

function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * The scan cache must change whenever the administrator edits the filter list,
 * otherwise content skipped as "unchanged" would keep an outdated verdict.
 */
function rulesFingerprint(rules: LexiconRule[]): string {
  if (rules.length === 0) return "none";
  return [...rules]
    .map((rule) => `${normalizeForScan(rule.term)}:${rule.severity}`)
    .sort()
    .join("|");
}

function scanHash(text: string, rules: LexiconRule[]): string {
  return createHash("sha256")
    .update(text)
    .update("\n--rules--\n")
    .update(rulesFingerprint(rules))
    .digest("hex");
}

type CachedCheck = {
  content_hash: string;
  provider: string;
};

type CachedFlag = {
  content_hash: string;
};

/**
 * True when this exact content was already scanned under the current filter
 * list and no stale flag is waiting to be reconciled. A local result is not
 * trusted while Gemini is configured, so a temporary Gemini outage is retried
 * later.
 */
async function shouldSkipScan(item: SafetyItem, scanKey: string, textHash: string): Promise<boolean> {
  const cached = await sqlite
    .prepare(
      "select content_hash, provider from safety_checks where target_type = ? and target_id = ?",
    )
    .get(item.targetType, item.targetId) as CachedCheck | undefined;
  if (!cached || cached.content_hash !== scanKey) return false;
  if (cached.provider === "local" && isGeminiConfigured()) return false;

  const flag = await sqlite
    .prepare(
      "select content_hash from safety_flags where target_type = ? and target_id = ?",
    )
    .get(item.targetType, item.targetId) as CachedFlag | undefined;
  return !flag || flag.content_hash === textHash;
}

async function recordCheck(item: SafetyItem, hash: string, assessment: SafetyAssessment): Promise<void> {
  await sqlite
    .prepare(
      `insert into safety_checks
         (target_type, target_id, content_hash, provider, severity, scanned_at)
       values (?, ?, ?, ?, ?, ?)
       on conflict(target_type, target_id) do update set
         content_hash = excluded.content_hash,
         provider = excluded.provider,
         severity = excluded.severity,
         scanned_at = excluded.scanned_at`,
    )
    .run(
      item.targetType,
      item.targetId,
      hash,
      assessment.provider,
      assessment.severity,
      Date.now(),
    );
}

/**
 * Merges Gemini's contextual answer with the explicit offline terms, or trusts
 * Gemini alone when it is configured and in authoritative mode. Administrator
 * filters always apply, even in authoritative mode.
 */
async function assessItems(
  items: SafetyItem[],
  customRules: LexiconRule[],
): Promise<Map<string, SafetyAssessment>> {
  const assessments = new Map<string, SafetyAssessment>();
  if (items.length === 0) return assessments;

  const config = safetyConfig();
  const customTerms = customRules.map((rule) => rule.term);
  if (isGeminiConfigured()) {
    for (const batch of chunks(items)) {
      try {
        const batchResult = await assessWithGemini(batch, customTerms);
        for (const [id, assessment] of batchResult) assessments.set(id, assessment);
      } catch (error) {
        console.warn(
          `[safety] Gemini request failed; using the local lexicon for this batch. ${
            error instanceof Error ? error.message : "Unknown error."
          }`,
        );
      }
    }
  }

  for (const item of items) {
    const gemini = assessments.get(item.id);
    const admin = scanAdminTerms(item.text, customRules);

    if (gemini && config.geminiMode === "authoritative") {
      assessments.set(
        item.id,
        admin.severity === "none" ? gemini : mergeAssessments(gemini, admin),
      );
      continue;
    }

    const local = scanWithLexicon(item.text, customRules);
    if (!gemini) {
      assessments.set(item.id, local);
      continue;
    }
    assessments.set(item.id, mergeAssessments(gemini, local));
  }

  return assessments;
}

async function insertSafetyNotice(item: SafetyItem, assessment: SafetyAssessment, now: number): Promise<void> {
  const kind =
    item.targetType === "entry"
      ? "post"
      : item.targetType === "comment"
        ? "comment"
        : "account";
  const terms = assessment.matchedTerms.slice(0, 6).join(", ");
  const categories = assessment.categories.slice(0, 4).join(", ");
  const body = [
    `${item.label} was flagged as ${assessment.severity} risk.`,
    categories ? `Categories: ${categories}.` : "",
    terms ? `Matched terms: ${terms}.` : "",
    assessment.explanation,
    `Excerpt: ${excerpt(item.text, 180)}`,
  ]
    .filter(Boolean)
    .join(" ");

  await sqlite
    .prepare(
      `insert into outbox (id, kind, to_role, to_user_id, subject, body, href, created_at, read_at)
       values (?, 'safety', 'admin', null, ?, ?, '/admin/safety', ?, null)`,
    )
    .run(
      newId("outbox"),
      `${assessment.severity.toUpperCase()} risk in ${kind === "account" ? "an" : "a"} ${kind}: ${excerpt(item.label, 80)}`,
      body,
      now,
    );
}

/**
 * Creates or refreshes one flag. Returns whether the finding is new, or whether
 * changed content (or a higher severity) put an already-reviewed flag back into
 * the admin queue.
 */
async function persistAssessment(
  item: SafetyItem,
  assessment: SafetyAssessment,
  notify: boolean,
): Promise<Pick<SafetyScanResult, "flagged" | "created" | "reopened" | "severity">> {
  const config = safetyConfig();
  const existing = await sqlite
    .prepare(
      "select id, severity, status, content_hash, reviewed_by, reviewed_at from safety_flags where target_type = ? and target_id = ?",
    )
    .get(item.targetType, item.targetId) as ExistingFlag | undefined;

  if (!meetsSeverity(assessment.severity, config.flagMinSeverity)) {
    if (existing) {
      await sqlite.prepare("delete from safety_flags where id = ?").run(existing.id);
    }
    return {
      flagged: false,
      created: false,
      reopened: false,
      severity: assessment.severity,
    };
  }

  const now = Date.now();
  const hash = contentHash(item.text);
  const escalated = Boolean(
    existing && severityRank(assessment.severity) > severityRank(existing.severity),
  );
  const reopened = Boolean(
    existing &&
      (hash !== existing.content_hash || escalated) &&
      existing.status !== "open",
  );

  if (existing) {
    await sqlite
      .prepare(
        `update safety_flags
            set target_label = ?, author_id = ?, severity = ?, categories = ?,
                matched_terms = ?, excerpt = ?, explanation = ?, provider = ?,
                content_hash = ?, status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
          where id = ?`,
      )
      .run(
        item.label,
        item.authorId,
        assessment.severity,
        JSON.stringify(assessment.categories),
        JSON.stringify(assessment.matchedTerms),
        excerpt(item.text, 320),
        assessment.explanation,
        assessment.provider,
        hash,
        reopened ? "open" : existing.status,
        reopened ? null : existing.reviewed_by,
        reopened ? null : existing.reviewed_at,
        now,
        existing.id,
      );
  } else {
    await sqlite
      .prepare(
        `insert into safety_flags
           (id, target_type, target_id, target_label, author_id, severity, categories,
            matched_terms, excerpt, explanation, provider, content_hash, status,
            reviewed_by, reviewed_at, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', null, null, ?, ?)`,
      )
      .run(
        newId("safety"),
        item.targetType,
        item.targetId,
        item.label,
        item.authorId,
        assessment.severity,
        JSON.stringify(assessment.categories),
        JSON.stringify(assessment.matchedTerms),
        excerpt(item.text, 320),
        assessment.explanation,
        assessment.provider,
        hash,
        now,
        now,
      );
  }

  const created = !existing;
  if (
    notify &&
    meetsSeverity(assessment.severity, config.notifyMinSeverity) &&
    (created || escalated || reopened)
  ) {
    await insertSafetyNotice(item, assessment, now);
  }

  return {
    flagged: true,
    created,
    reopened,
    severity: assessment.severity,
  };
}

function entryItem(row: EntryRow): SafetyItem {
  const config = safetyConfig();
  return {
    id: `entry:${row.id}`,
    targetType: "entry",
    targetId: row.id,
    label: row.title,
    text: `Post title: ${row.title}\n\n${row.body}`,
    authorId:
      row.is_anonymous && !config.attributeAnonymous ? null : row.author_id,
  };
}

function accountItem(row: AccountRow): SafetyItem {
  return {
    id: `account:${row.id}`,
    targetType: "account",
    targetId: row.id,
    label: row.display_name,
    text: `Display name: ${row.display_name}\nUsername: ${row.username}`,
    authorId: row.id,
  };
}

function commentItem(row: CommentRow): SafetyItem {
  const config = safetyConfig();
  return {
    id: `comment:${row.id}`,
    targetType: "comment",
    targetId: row.id,
    label: `Comment on "${row.entry_title}"`,
    text: `Comment on post "${row.entry_title}":\n\n${row.body}`,
    authorId:
      row.is_anonymous && !config.attributeAnonymous ? null : row.author_id,
  };
}

const COMMENT_QUERY = `select cm.id, cm.entry_id, cm.author_id, cm.body, cm.is_anonymous,
       e.title as entry_title
  from comments cm
  join entries e on e.id = cm.entry_id`;

/** Scans one post. Drafts stay private unless explicitly opted in. */
export async function scanEntry(entryId: string): Promise<SafetyScanResult | null> {
  const row = await sqlite
    .prepare(
      "select id, title, body, author_id, is_anonymous, status from entries where id = ?",
    )
    .get(entryId) as EntryRow | undefined;
  if (!row) return null;
  if (row.status === "draft" && !safetyConfig().includeDrafts) return null;

  const rules = await listSafetyRules();
  const item = entryItem(row);
  const hash = scanHash(item.text, rules);
  if (await shouldSkipScan(item, hash, contentHash(item.text))) return null;

  const assessments = await assessItems([item], rules);
  const assessment = assessments.get(item.id) ?? scanWithLexicon(item.text, rules);
  const outcome = await persistAssessment(item, assessment, true);
  await recordCheck(item, hash, assessment);
  return {
    targetType: item.targetType,
    targetId: item.targetId,
    label: item.label,
    provider: assessment.provider,
    ...outcome,
  };
}

/** Scans one comment body, attributing anonymous authors only when opted in. */
export async function scanComment(commentId: string): Promise<SafetyScanResult | null> {
  const row = await sqlite
    .prepare(`${COMMENT_QUERY} where cm.id = ?`)
    .get(commentId) as CommentRow | undefined;
  if (!row) return null;

  const rules = await listSafetyRules();
  const item = commentItem(row);
  const hash = scanHash(item.text, rules);
  if (await shouldSkipScan(item, hash, contentHash(item.text))) return null;

  const assessments = await assessItems([item], rules);
  const assessment = assessments.get(item.id) ?? scanWithLexicon(item.text, rules);
  const outcome = await persistAssessment(item, assessment, true);
  await recordCheck(item, hash, assessment);
  return {
    targetType: item.targetType,
    targetId: item.targetId,
    label: item.label,
    provider: assessment.provider,
    ...outcome,
  };
}

/** Scans one real account's display name and username. */
export async function scanAccount(accountId: string): Promise<SafetyScanResult | null> {
  const row = await sqlite
    .prepare(
      "select id, username, display_name from users where id = ? and is_anonymous = 0",
    )
    .get(accountId) as AccountRow | undefined;
  if (!row) return null;

  const rules = await listSafetyRules();
  const item = accountItem(row);
  const hash = scanHash(item.text, rules);
  if (await shouldSkipScan(item, hash, contentHash(item.text))) return null;

  const assessments = await assessItems([item], rules);
  const assessment = assessments.get(item.id) ?? scanWithLexicon(item.text, rules);
  const outcome = await persistAssessment(item, assessment, true);
  await recordCheck(item, hash, assessment);
  return {
    targetType: item.targetType,
    targetId: item.targetId,
    label: item.label,
    provider: assessment.provider,
    ...outcome,
  };
}

/**
 * Scans every non-draft post, every comment, and every real account, then
 * writes one summary outbox notice for the administrator. This is the button
 * in /admin/safety.
 */
export async function runFullSafetyScan(): Promise<FullScanResult> {
  const config = safetyConfig();
  const entryRows = await sqlite
    .prepare(
      `select id, title, body, author_id, is_anonymous, status from entries${
        config.includeDrafts ? "" : " where status != 'draft'"
      }`,
    )
    .all() as EntryRow[];
  const commentRows = await sqlite
    .prepare(
      `${COMMENT_QUERY}${config.includeDrafts ? "" : " where e.status != 'draft'"}`,
    )
    .all() as CommentRow[];
  const accountRows = await sqlite
    .prepare(
      "select id, username, display_name from users where is_anonymous = 0",
    )
    .all() as AccountRow[];

  const items = [
    ...entryRows.map(entryItem),
    ...commentRows.map(commentItem),
    ...accountRows.map(accountItem),
  ];
  const rules = await listSafetyRules();
  const assessments = await assessItems(items, rules);

  let flagged = 0;
  let noteworthy = 0;
  let created = 0;
  let reopened = 0;
  for (const item of items) {
    const assessment = assessments.get(item.id);
    if (!assessment) continue;
    const outcome = await persistAssessment(item, assessment, false);
    await recordCheck(item, scanHash(item.text, rules), assessment);
    if (outcome.flagged) {
      flagged += 1;
      if (meetsSeverity(outcome.severity, config.notifyMinSeverity)) noteworthy += 1;
    }
    if (outcome.created) created += 1;
    if (outcome.reopened) reopened += 1;
  }

  const provider: "gemini" | "local" =
    isGeminiConfigured() &&
    items.some((item) => assessments.get(item.id)?.provider === "gemini")
      ? "gemini"
      : "local";
  const now = Date.now();

  await sqlite
    .prepare(
      `insert into safety_scans
         (id, scanned_count, flagged_count, notified_count, provider, created_at)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .run(newId("safety-scan"), items.length, flagged, noteworthy, provider, now);

  if (noteworthy > 0) {
    await sqlite
      .prepare(
        `insert into outbox (id, kind, to_role, to_user_id, subject, body, href, created_at, read_at)
         values (?, 'safety', 'admin', null, ?, ?, '/admin/safety', ?, null)`,
      )
      .run(
        newId("outbox"),
        `Content safety scan flagged ${noteworthy} item${noteworthy === 1 ? "" : "s"} needing attention`,
        `Scanned ${entryRows.length} posts, ${commentRows.length} comments, and ${accountRows.length} accounts with ${
          provider === "gemini" ? `Gemini (${GEMINI_MODEL})` : "the offline lexicon"
        }. ${created} new flag${created === 1 ? "" : "s"}${
          reopened > 0 ? `, ${reopened} reopened` : ""
        }. ${flagged - noteworthy} lower-risk finding${
          flagged - noteworthy === 1 ? "" : "s"
        } recorded without an alert. Open the safety console for details.`,
        now,
      );
  }

  return {
    scannedEntries: entryRows.length,
    scannedComments: commentRows.length,
    scannedAccounts: accountRows.length,
    flagged,
    noteworthy,
    created,
    reopened,
    provider,
    geminiConfigured: isGeminiConfigured(),
    model: GEMINI_MODEL,
  };
}

/**
 * Runs after the response is sent so a student's submit/edit never waits on a
 * network call to Gemini. Errors are logged, never surfaced to the user.
 */
export function scheduleContentScan(target: SafetyTarget, id: string): void {
  try {
    after(async () => {
      try {
        if (target === "entry") await scanEntry(id);
        else if (target === "comment") await scanComment(id);
        else await scanAccount(id);
      } catch (error) {
        console.error(
          `[safety] Automatic ${target} scan failed for ${id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    });
  } catch (error) {
    console.error(
      `[safety] Could not schedule ${target} scan for ${id}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
