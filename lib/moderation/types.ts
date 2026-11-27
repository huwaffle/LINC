export type SafetyTarget = "entry" | "account" | "comment";
export type SafetySeverity = "none" | "low" | "medium" | "high";
export type SafetyProvider = "gemini" | "local";

/** A single post, comment, or account sent to the moderation model. */
export type SafetyItem = {
  /** Stable id inside one scan request (usually `${targetType}:${targetId}`). */
  id: string;
  targetType: SafetyTarget;
  targetId: string;
  /** Human-readable title/name shown in the admin console. */
  label: string;
  /** Full text the model should review. */
  text: string;
  /** Author account id; null for anonymous posts. */
  authorId: string | null;
};

export type SafetyAssessment = {
  severity: SafetySeverity;
  categories: string[];
  matchedTerms: string[];
  explanation: string;
  provider: SafetyProvider;
};

export function severityRank(severity: SafetySeverity): number {
  return { none: 0, low: 1, medium: 2, high: 3 }[severity];
}

export function maxSeverity(a: SafetySeverity, b: SafetySeverity): SafetySeverity {
  return severityRank(a) >= severityRank(b) ? a : b;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

/**
 * Merges two assessments, keeping the more severe verdict and the explanation
 * that came with it. Used to combine Gemini with the offline lexicon, and to
 * make administrator filters override an authoritative "none" from Gemini.
 */
export function mergeAssessments(
  primary: SafetyAssessment,
  secondary: SafetyAssessment,
): SafetyAssessment {
  const severity = maxSeverity(primary.severity, secondary.severity);
  const source =
    severityRank(secondary.severity) > severityRank(primary.severity)
      ? secondary
      : primary;

  return {
    severity,
    categories: unique([...primary.categories, ...secondary.categories]),
    matchedTerms: unique([...primary.matchedTerms, ...secondary.matchedTerms]),
    explanation: source.explanation,
    provider: primary.provider,
  };
}
