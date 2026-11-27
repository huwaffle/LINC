import fs from "node:fs";
import path from "node:path";
import { sqlite, closeDatabase } from "../lib/db/client";
import { Bm25Index } from "../lib/ml/bm25";
import { precisionAtK, recallAtK } from "../lib/ml/metrics";
import { toTsQuery } from "../lib/search";

type Judgment = { query: string; relevant: string[] };

const KS = [1, 3, 5];
const judgments = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "ml", "search-judgments.json"), "utf8"),
) as Judgment[];

const docs = await sqlite
  .prepare("select id, title, body from entries where status = 'published'")
  .all() as Array<{ id: string; title: string; body: string }>;

const buildStart = performance.now();
const bm25 = new Bm25Index(docs);
const buildMs = performance.now() - buildStart;

/** Baseline: PostgreSQL full-text search using the generated tsvector column. */
async function fts(query: string): Promise<string[]> {
  const match = toTsQuery(query);
  if (!match) return [];
  return (
    await sqlite
      .prepare(
        `select id from entries
         where search_tsv @@ to_tsquery('english', ?) and status = 'published'
         order by ts_rank(search_tsv, to_tsquery('english', ?)) desc limit 50`,
      )
      .all(match, match) as Array<{ id: string }>
  ).map((row) => row.id);
}

type Run = { p: Record<number, number[]>; r: Record<number, number[]>; times: number[] };
const empty = (): Run => ({ p: { 1: [], 3: [], 5: [] }, r: { 1: [], 3: [], 5: [] }, times: [] });
const results = { bm25: empty(), pgfts: empty() };
let used = 0;

for (const j of judgments) {
  const relevant = new Set(
    docs.filter((d) => j.relevant.some((needle) => d.title.toLowerCase().includes(needle))).map((d) => d.id),
  );
  if (relevant.size === 0) continue;
  used += 1;

  for (const [name, search] of [
    ["bm25", (q: string) => bm25.search(q, 50).map((h) => h.id)],
    ["pgfts", fts],
  ] as const) {
    const t0 = performance.now();
    const ranked = await search(j.query);
    results[name].times.push(performance.now() - t0);
    for (const k of KS) {
      results[name].p[k].push(precisionAtK(ranked, relevant, k));
      results[name].r[k].push(recallAtK(ranked, relevant, k));
    }
  }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil(xs.length * 0.95) - 1)] ?? 0;

const summary = Object.fromEntries(
  (Object.keys(results) as Array<keyof typeof results>).map((name) => [
    name,
    {
      precisionAtK: Object.fromEntries(KS.map((k) => [k, mean(results[name].p[k])])),
      recallAtK: Object.fromEntries(KS.map((k) => [k, mean(results[name].r[k])])),
      meanMs: mean(results[name].times),
      p95Ms: p95(results[name].times),
    },
  ]),
);

console.log(`Search evaluation: ${used} judged queries over ${docs.length} published posts`);
console.log(`BM25 index build: ${buildMs.toFixed(2)} ms\n`);
console.log("method".padEnd(8), ...KS.map((k) => `P@${k}`.padStart(7)), ...KS.map((k) => `R@${k}`.padStart(7)), "mean ms".padStart(9), "p95 ms".padStart(8));
for (const [name, s] of Object.entries(summary)) {
  console.log(
    name.padEnd(8),
    ...KS.map((k) => s.precisionAtK[k].toFixed(3).padStart(7)),
    ...KS.map((k) => s.recallAtK[k].toFixed(3).padStart(7)),
    s.meanMs.toFixed(3).padStart(9),
    s.p95Ms.toFixed(3).padStart(8),
  );
}

const out = path.join(process.cwd(), "storage", "models", "search-evaluation.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  JSON.stringify({ queries: used, documents: docs.length, indexBuildMs: buildMs, ks: KS, summary, evaluatedAt: Date.now() }, null, 2),
);
await closeDatabase();
