import { tokenize } from "./text";

export type Bm25Doc = { id: string; title: string; body: string };

export type Bm25Options = {
  /** Term-frequency saturation. */
  k1?: number;
  /** Length normalisation (0 = none, 1 = full). */
  b?: number;
  /** A title token counts this many times, so title matches outrank body matches. */
  titleBoost?: number;
};

/**
 * Okapi BM25.
 *
 *   score(D, Q) = sum over q in Q of  IDF(q) * f(q,D) * (k1 + 1)
 *                                     / (f(q,D) + k1 * (1 - b + b * |D| / avgdl))
 *   IDF(q)      = ln(1 + (N - n(q) + 0.5) / (n(q) + 0.5))
 */
export class Bm25Index {
  private readonly k1: number;
  private readonly b: number;
  private readonly postings = new Map<string, Array<[number, number]>>();
  private readonly lengths: number[] = [];
  private readonly ids: string[] = [];
  private readonly avgdl: number;

  constructor(docs: Bm25Doc[], options: Bm25Options = {}) {
    this.k1 = options.k1 ?? 1.5;
    this.b = options.b ?? 0.75;
    const boost = options.titleBoost ?? 2;

    docs.forEach((doc, index) => {
      const tokens = tokenize(doc.body);
      for (let i = 0; i < boost; i += 1) tokens.push(...tokenize(doc.title));

      const counts = new Map<string, number>();
      for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
      for (const [term, count] of counts) {
        const list = this.postings.get(term) ?? [];
        list.push([index, count]);
        this.postings.set(term, list);
      }
      this.ids.push(doc.id);
      this.lengths.push(tokens.length);
    });

    this.avgdl = this.lengths.reduce((a, b) => a + b, 0) / Math.max(1, this.lengths.length);
  }

  get size(): number {
    return this.ids.length;
  }

  /** Ranked documents with a positive score, best first. */
  search(query: string, limit = 50): Array<{ id: string; score: number }> {
    const terms = [...new Set(tokenize(query))];
    const scores = new Map<number, number>();
    const n = this.ids.length;

    for (const term of terms) {
      const list = this.postings.get(term);
      if (!list) continue;
      const idf = Math.log(1 + (n - list.length + 0.5) / (list.length + 0.5));
      for (const [doc, tf] of list) {
        const norm = 1 - this.b + (this.b * this.lengths[doc]) / (this.avgdl || 1);
        const score = (idf * tf * (this.k1 + 1)) / (tf + this.k1 * norm);
        scores.set(doc, (scores.get(doc) ?? 0) + score);
      }
    }

    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, limit)
      .map(([doc, score]) => ({ id: this.ids[doc], score }));
  }
}
