/** Shared text normalisation for the TF-IDF classifier and the BM25 ranker. */

const STOPWORDS = new Set(
  (
    "a about above after again all also am an and any are as at be because been before being below " +
    "between both but by can could did do does doing down during each few for from further had has " +
    "have having he her here hers him his how i if in into is it its just me more most my no nor not " +
    "of off on once only or other our out over own same she should so some such than that the their " +
    "them then there these they this those through to too under until up very was we were what when " +
    "where which while who whom why will with would you your please kindly " +
    "ang ng sa na ako ba po saan ano paano kailan para mga ay at si ni"
  ).split(" "),
);

/** Very small suffix stripper, enough to match "enrolling"/"enrolled"/"enrollments". */
export function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith("sses")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  for (const suffix of ["ments", "ment", "ing", "ed", "ly"]) {
    if (w.length - suffix.length >= 4 && w.endsWith(suffix)) return w.slice(0, -suffix.length);
  }
  return w;
}

/** Lower-cased word tokens without stopwords, stemmed. Letters and digits only. */
export function tokenize(text: string): string[] {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.filter((w) => w.length > 1 && !STOPWORDS.has(w)).map(stem);
}

/** Mulberry32 PRNG so training and cross-validation are reproducible. */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
