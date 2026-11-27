import { severityRank, type SafetySeverity } from "./types";

export type GeminiMode = "authoritative" | "combine";

export type SafetyConfig = {
  /** Lowest severity that is stored as a flag in the admin console. */
  flagMinSeverity: SafetySeverity;
  /** Lowest severity that writes an admin outbox notice. */
  notifyMinSeverity: SafetySeverity;
  /** Send private drafts to the scanner (off by default to protect privacy). */
  includeDrafts: boolean;
  /** Keep the author's account id on anonymous findings (off by default). */
  attributeAnonymous: boolean;
  /** Trust Gemini when available, or merge its answer with the offline lexicon. */
  geminiMode: GeminiMode;
  /** Number of posts/accounts per Gemini request. */
  batchSize: number;
  /** Characters of each item sent to Gemini. */
  maxCharsPerItem: number;
  /** Per-request Gemini timeout. */
  timeoutMs: number;
};

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

function envSeverity(
  name: string,
  fallback: Exclude<SafetySeverity, "none">,
): Exclude<SafetySeverity, "none"> {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "low" || raw === "medium" || raw === "high" ? raw : fallback;
}

/**
 * Scanning behavior is read at call time so tests and a running server can
 * change it without a rebuild. Defaults are deliberately conservative: record
 * everything from low up, but only interrupt the administrator for medium+.
 */
export function safetyConfig(): SafetyConfig {
  return {
    flagMinSeverity: envSeverity("SAFETY_FLAG_MIN_SEVERITY", "low"),
    notifyMinSeverity: envSeverity("SAFETY_NOTIFY_MIN_SEVERITY", "medium"),
    includeDrafts: envBool("SAFETY_INCLUDE_DRAFTS", false),
    attributeAnonymous: envBool("SAFETY_ATTRIBUTE_ANONYMOUS", false),
    geminiMode:
      process.env.SAFETY_GEMINI_MODE?.trim().toLowerCase() === "combine"
        ? "combine"
        : "authoritative",
    batchSize: envInt("SAFETY_BATCH_SIZE", 40, 1, 100),
    maxCharsPerItem: envInt("SAFETY_MAX_CHARS_PER_ITEM", 6_000, 500, 50_000),
    timeoutMs: envInt("SAFETY_TIMEOUT_MS", 60_000, 1_000, 120_000),
  };
}

export function meetsSeverity(
  severity: SafetySeverity,
  minimum: SafetySeverity,
): boolean {
  return severityRank(severity) >= severityRank(minimum);
}
