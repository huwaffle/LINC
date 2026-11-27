/** Pure helpers for search: tokenizing, full-text query building, suggestions, highlighting. */

const WORD = /[\p{L}\p{N}]+/gu;
const MAX_TERMS = 8;

/**
 * Splits on anything that is not a letter or digit, so "pre-loved" becomes
 * ["pre", "loved"] before building a PostgreSQL text-search query.
 */
export function tokenizeQuery(input: string): string[] {
  const terms = (input.toLowerCase().match(WORD) ?? []).filter((t) => t.length > 1);
  return [...new Set(terms)].slice(0, MAX_TERMS);
}

/** Every term becomes a prefix match; `all` requires every term, otherwise any. */
export function toFtsQuery(input: string, mode: "all" | "any" = "all"): string | null {
  const terms = tokenizeQuery(input);
  if (!terms.length) return null;
  return terms.map((t) => `"${t}"*`).join(mode === "all" ? " AND " : " OR ");
}

/** PostgreSQL full-text equivalent of `toFtsQuery`, with prefix matching. */
export function toTsQuery(input: string, mode: "all" | "any" = "all"): string | null {
  const terms = tokenizeQuery(input);
  if (!terms.length) return null;
  return terms.map((t) => `${t}:*`).join(mode === "all" ? " & " : " | ");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Suggests a corrected query by swapping each unknown term for the closest
 * known word. Returns null when nothing needs (or can be) corrected.
 */
export function didYouMean(input: string, vocabulary: Iterable<string>): string | null {
  const terms = tokenizeQuery(input);
  if (!terms.length) return null;

  const words = new Set<string>();
  for (const word of vocabulary) words.add(word);

  let changed = false;
  const fixed = terms.map((term) => {
    const known = [...words].some((w) => w.startsWith(term));
    if (known) return term;

    const limit = term.length <= 4 ? 1 : 2;
    let best: { word: string; distance: number } | null = null;
    for (const word of words) {
      if (Math.abs(word.length - term.length) > limit) continue;
      const distance = levenshtein(term, word);
      if (distance <= limit && (!best || distance < best.distance)) best = { word, distance };
    }
    if (!best) return term;
    changed = true;
    return best.word;
  });

  return changed ? fixed.join(" ") : null;
}

export function vocabularyOf(texts: string[]): Set<string> {
  const words = new Set<string>();
  for (const text of texts) {
    for (const word of text.toLowerCase().match(WORD) ?? []) {
      if (word.length > 1) words.add(word);
    }
  }
  return words;
}

export type HighlightPart = { text: string; match: boolean };

function matches(word: string, terms: string[]): boolean {
  const lower = word.toLowerCase();
  return terms.some(
    (term) =>
      lower.startsWith(term) ||
      // The index is stemmed, so "loved" should also light up "love".
      (lower.length >= 3 && term.length > lower.length && term.startsWith(lower)),
  );
}

/** Splits text into plain and matching parts for rendering with <mark>. */
export function highlightParts(text: string, terms: string[]): HighlightPart[] {
  if (!terms.length || !text) return [{ text, match: false }];

  const parts: HighlightPart[] = [];
  let last = 0;
  for (const found of text.matchAll(WORD)) {
    const start = found.index ?? 0;
    if (!matches(found[0], terms)) continue;
    if (start > last) parts.push({ text: text.slice(last, start), match: false });
    parts.push({ text: found[0], match: true });
    last = start + found[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts.length ? parts : [{ text, match: false }];
}
