import { tokenize } from "./text";

export type SparseVector = { index: number[]; value: number[] };

export type TfidfModel = { vocabulary: Record<string, number>; idf: number[] };

function terms(text: string): string[] {
  const unigrams = tokenize(text);
  const bigrams = unigrams.slice(1).map((t, i) => `${unigrams[i]} ${t}`);
  return [...unigrams, ...bigrams];
}

/**
 * TF-IDF with sublinear term frequency (1 + ln tf), smoothed IDF
 * (ln((1 + N) / (1 + df)) + 1) and L2-normalised rows. Unigrams and bigrams.
 */
export function fitTfidf(texts: string[], maxFeatures = 6000): TfidfModel {
  const df = new Map<string, number>();
  for (const text of texts) {
    for (const term of new Set(terms(text))) df.set(term, (df.get(term) ?? 0) + 1);
  }

  const kept = [...df.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, maxFeatures);

  const vocabulary: Record<string, number> = {};
  const idf: number[] = [];
  kept.forEach(([term, count], i) => {
    vocabulary[term] = i;
    idf.push(Math.log((1 + texts.length) / (1 + count)) + 1);
  });
  return { vocabulary, idf };
}

export function transformTfidf(model: TfidfModel, text: string): SparseVector {
  const counts = new Map<number, number>();
  for (const term of terms(text)) {
    const i = model.vocabulary[term];
    if (i !== undefined) counts.set(i, (counts.get(i) ?? 0) + 1);
  }

  const index = [...counts.keys()].sort((a, b) => a - b);
  const value = index.map((i) => (1 + Math.log(counts.get(i)!)) * model.idf[i]);
  const norm = Math.sqrt(value.reduce((sum, v) => sum + v * v, 0)) || 1;
  return { index, value: value.map((v) => v / norm) };
}
