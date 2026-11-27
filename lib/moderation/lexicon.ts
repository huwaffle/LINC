import { maxSeverity, type SafetyAssessment, type SafetySeverity } from "./types";

type Rule = {
  term: string;
  severity: Exclude<SafetySeverity, "none">;
  category: string;
};

/** A matching rule the scanner should apply in addition to its built-in list. */
export type LexiconRule = Rule;

function rules(
  severity: Exclude<SafetySeverity, "none">,
  category: string,
  terms: string[],
): Rule[] {
  return terms.map((term) => ({ term, severity, category }));
}

/**
 * A deliberately small, offline fallback. Gemini is the primary detector and
 * understands context; this list only catches the most common explicit terms
 * when the API is unavailable (or is not configured on this machine).
 */
const RULES: Rule[] = [
  ...rules("high", "threat", [
    "kill yourself",
    "kys",
    "go die",
    "i will kill you",
    "shoot you",
    "stab you",
    "rape",
    "papatayin kita",
    "sasaksakin kita",
    "magpakamatay ka",
  ]),
  ...rules("high", "slur", [
    "faggot",
    "fag",
    "nigger",
    "nigga",
    "retard",
    "tranny",
    "chink",
    "spic",
    "kike",
    "wetback",
  ]),
  ...rules("medium", "profanity", [
    "motherfucker",
    "fuck",
    "fucker",
    "fucking",
    "cunt",
    "dickhead",
    "asshole",
    "bastard",
    "bullshit",
    "bitch",
    "shit",
    "whore",
    "slut",
    "prick",
    "twat",
    "wanker",
    "douchebag",
    "dumbass",
    "jackass",
    "dipshit",
    "cock",
    "pussy",
  ]),
  ...rules("low", "profanity", [
    "damn",
    "crap",
    "piss",
    "hell",
    "ass",
    "arse",
    "bollocks",
    "bloody",
  ]),
  ...rules("medium", "profanity", [
    "putangina",
    "putang ina",
    "putanginamo",
    "tangina",
    "tanginamo",
    "puta",
    "pota",
    "gago",
    "gaga",
    "tarantado",
    "bobo",
    "tanga",
    "ulol",
    "punyeta",
    "kingina",
    "pakingshet",
    "shet",
    "bwisit",
    "hinayupak",
    "putragis",
    "inutil",
    "lintik",
    "siraulo",
    "kupal",
    "ungas",
    "gunggong",
    "manyak",
    "pokpok",
    "malandi",
    "tae",
    "burat",
    "hindot",
    "kantot",
    "jakol",
  ]),
];

/** The built-in offline word list, grouped for display in the admin safety console. */
export function listBuiltInGroups(): Array<{ severity: Rule["severity"]; category: string; terms: string[] }> {
  const groups = new Map<string, { severity: Rule["severity"]; category: string; terms: string[] }>();
  for (const rule of RULES) {
    const key = `${rule.severity}:${rule.category}`;
    const group = groups.get(key) ?? { severity: rule.severity, category: rule.category, terms: [] };
    group.terms.push(rule.term);
    groups.set(key, group);
  }
  const order = { high: 0, medium: 1, low: 2 };
  return [...groups.values()].sort((a, b) => order[a.severity] - order[b.severity]);
}

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "|": "i",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Lowercases, folds common leetspeak, collapses long letter runs (so "fuuuck"
 * matches "fuck"), and turns punctuation into spaces. Two-letter runs such as
 * the double "s" in "ass" are preserved.
 */
export function normalizeForScan(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[0-9@$|]/g, (char) => LEET[char] ?? char)
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Trims a term typed by an administrator without changing how it reads. */
export function normalizeCustomTerm(input: string): string {
  return input
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matcherFor(rule: Rule) {
  const term = normalizeForScan(rule.term) || rule.term.toLowerCase();
  return {
    ...rule,
    pattern: new RegExp(`\\b${escapeRegExp(term)}\\b`, "g"),
  };
}

const MATCHERS = RULES.map(matcherFor);

function assessMatchers(
  text: string,
  matchers: ReturnType<typeof matcherFor>[],
  adminOnly: boolean,
): SafetyAssessment {
  const normalized = normalizeForScan(text);
  const terms = new Set<string>();
  const categories = new Set<string>();
  let severity: SafetySeverity = "none";

  for (const matcher of matchers) {
    matcher.pattern.lastIndex = 0;
    if (!matcher.pattern.test(normalized)) continue;
    terms.add(matcher.term);
    categories.add(matcher.category);
    severity = maxSeverity(severity, matcher.severity);
  }

  const matchedTerms = [...terms];
  return {
    severity,
    categories: [...categories],
    matchedTerms,
    explanation:
      matchedTerms.length === 0
        ? adminOnly
          ? "No administrator-added filters matched."
          : "No listed profanity, slurs, or threats were found."
        : adminOnly
          ? `Matched ${matchedTerms.length} administrator-added offensive term${
              matchedTerms.length === 1 ? "" : "s"
            }.`
          : `The offline lexicon matched ${matchedTerms.length} listed term${
              matchedTerms.length === 1 ? "" : "s"
            }.`,
    provider: "local",
  };
}

/**
 * Offline profanity/slur/threat scan. Returns a conservative assessment that
 * the caller can merge with Gemini's contextual answer. Extra rules come from
 * the admin-managed offensive-word filters.
 */
export function scanWithLexicon(
  text: string,
  extraRules: LexiconRule[] = [],
): SafetyAssessment {
  const matchers = extraRules.length
    ? [...MATCHERS, ...extraRules.map(matcherFor)]
    : MATCHERS;
  return assessMatchers(text, matchers, false);
}

/**
 * Matches only the administrator's filters. These are honoured even when
 * Gemini is authoritative, because an explicit admin instruction should not be
 * overridden by the model's contextual judgement.
 */
export function scanAdminTerms(text: string, rules: LexiconRule[]): SafetyAssessment {
  return assessMatchers(text, rules.map(matcherFor), true);
}
