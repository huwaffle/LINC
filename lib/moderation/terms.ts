import { sqlite } from "../db/client";
import { newId } from "../db/users";
import { normalizeCustomTerm, normalizeForScan, type LexiconRule } from "./lexicon";
import type { SafetySeverity } from "./types";

export type SafetySeverityInput = Exclude<SafetySeverity, "none">;

export type SafetyTermRecord = {
  id: string;
  term: string;
  severity: SafetySeverityInput;
  category: string;
  created_by: string | null;
  created_at: number;
};

export const SAFETY_TERM_CATEGORY = "admin filter";
export const MIN_TERM_LENGTH = 2;
export const MAX_TERM_LENGTH = 60;

export function isSafetySeverity(value: string): value is SafetySeverityInput {
  return value === "low" || value === "medium" || value === "high";
}

/** Normalizes and validates a term submitted from the admin console. */
export function validateSafetyTerm(
  input: string,
): { ok: true; term: string } | { ok: false; error: string } {
  const term = normalizeCustomTerm(input);
  const matchable = normalizeForScan(term);

  if (!term || !matchable) {
    return { ok: false, error: "Enter a word or phrase to filter." };
  }
  if (term.length > MAX_TERM_LENGTH) {
    return {
      ok: false,
      error: `Filters must be ${MAX_TERM_LENGTH} characters or fewer.`,
    };
  }
  if (matchable.length < MIN_TERM_LENGTH) {
    return {
      ok: false,
      error: `Filters must contain at least ${MIN_TERM_LENGTH} letters or digits.`,
    };
  }
  return { ok: true, term };
}

/** Every administrator-managed filter, newest first. */
export async function listSafetyTerms(): Promise<SafetyTermRecord[]> {
  return await sqlite
    .prepare(
      `select id, term, severity, category, created_by, created_at
       from safety_terms order by created_at desc, term asc`,
    )
    .all() as SafetyTermRecord[];
}

/** The rules the scanner should apply on top of its built-in lexicon. */
export async function listSafetyRules(): Promise<LexiconRule[]> {
  return (await listSafetyTerms()).map((record) => ({
    term: record.term,
    severity: record.severity,
    category: record.category,
  }));
}

/**
 * Inserts a new filter, or updates the severity when the same word already
 * exists with different casing/spacing. Returns what happened so the admin
 * console can show an accurate message.
 */
export async function saveSafetyTerm(
  term: string,
  severity: SafetySeverityInput,
  createdBy: string | null,
): Promise<"created" | "updated"> {
  const existing = await sqlite
    .prepare("select id from safety_terms where lower(term) = lower(?)")
    .get(term) as { id: string } | undefined;

  if (existing) {
    await sqlite
      .prepare("update safety_terms set term = ?, severity = ? where id = ?")
      .run(term, severity, existing.id);
    return "updated";
  }

  await sqlite
    .prepare(
      `insert into safety_terms (id, term, severity, category, created_by, created_at)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .run(newId("safety-term"), term, severity, SAFETY_TERM_CATEGORY, createdBy, Date.now());
  return "created";
}

export async function deleteSafetyTerm(id: string): Promise<boolean> {
  return (await sqlite.prepare("delete from safety_terms where id = ?").run(id)).changes > 0;
}

/**
 * Editing the filter list changes what counts as a match, so cached scans are
 * no longer trustworthy. Clearing the cache makes the next automatic or bulk
 * scan evaluate content again with the new rules.
 */
export async function invalidateSafetyChecks(): Promise<void> {
  await sqlite.prepare("delete from safety_checks").run();
}
