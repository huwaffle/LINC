export const dynamic = "force-dynamic";

import fs from "node:fs";
import path from "node:path";
import { EVAL_PATH } from "@/lib/ml/classifier";
import type { ClassificationReport } from "@/lib/ml/metrics";
import { formatDateTime } from "@/lib/format";

type ClassifierEval = ClassificationReport & { folds: number; evaluatedAt: number };
type SearchEval = {
  queries: number;
  documents: number;
  indexBuildMs: number;
  ks: number[];
  summary: Record<
    string,
    { precisionAtK: Record<string, number>; recallAtK: Record<string, number>; meanMs: number; p95Ms: number }
  >;
  evaluatedAt: number;
};

function read<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default async function AlgorithmsPage() {
  const classifier = read<ClassifierEval>(EVAL_PATH);
  const search = read<SearchEval>(path.join(process.cwd(), "storage", "models", "search-evaluation.json"));

  return (
    <div className="pb-8">
      <div className="px-4 py-4">
        <h1 className="text-[19px] font-bold tracking-[-0.02em] text-ink">Algorithms</h1>
        <p className="text-[13px] leading-relaxed text-neutral-500">
          Evaluation results for the two algorithms behind the system. Regenerate them with{" "}
          <code className="rounded bg-neutral-100 px-1 text-[11px]">npm run ml:train</code> and{" "}
          <code className="rounded bg-neutral-100 px-1 text-[11px]">npm run ml:eval-search</code>.
        </p>
      </div>

      <section className="border-t border-line px-4 py-4">
        <h2 className="text-[15px] font-bold text-ink">1. TF-IDF + Support Vector Machine</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
          Suggests a category for a new submission. Text becomes TF-IDF features (unigrams and
          bigrams) and a one-vs-rest linear SVM predicts the category.
        </p>
        {!classifier ? (
          <p className="mt-3 text-[13px] text-neutral-500">No evaluation yet. Run the train script.</p>
        ) : (
          <>
            <p className="mt-3 text-[12px] text-neutral-400">
              {classifier.total} labeled examples, stratified {classifier.folds}-fold cross-validation,{" "}
              {formatDateTime(classifier.evaluatedAt)}
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left text-[12px]">
                <thead>
                  <tr className="border-y border-line text-[11px] uppercase tracking-wide text-neutral-400">
                    <th className="py-2 pr-3">Category</th>
                    <th className="px-3">Precision</th>
                    <th className="px-3">Recall</th>
                    <th className="px-3">F1</th>
                    <th className="px-3">Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {classifier.perClass.map((c) => (
                    <tr key={c.label}>
                      <td className="py-1.5 pr-3 font-medium text-ink">{c.label}</td>
                      <td className="px-3">{pct(c.precision)}</td>
                      <td className="px-3">{pct(c.recall)}</td>
                      <td className="px-3">{pct(c.f1)}</td>
                      <td className="px-3">{c.support}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold text-ink">
                    <td className="py-1.5 pr-3">Macro average</td>
                    <td className="px-3">{pct(classifier.macro.precision)}</td>
                    <td className="px-3">{pct(classifier.macro.recall)}</td>
                    <td className="px-3">{pct(classifier.macro.f1)}</td>
                    <td className="px-3">{classifier.total}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[13px] text-ink">
              Accuracy <span className="font-semibold">{pct(classifier.accuracy)}</span>
            </p>

            <h3 className="mt-4 text-[13px] font-semibold text-ink">Confusion matrix</h3>
            <p className="text-[11px] text-neutral-400">Rows are the true category, columns the prediction.</p>
            <div className="mt-2 overflow-x-auto">
              <table className="border-collapse text-center text-[11px]">
                <thead>
                  <tr>
                    <th />
                    {classifier.labels.map((l) => (
                      <th key={l} className="px-2 py-1 font-semibold text-neutral-500">
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classifier.confusion.map((row, i) => (
                    <tr key={classifier.labels[i]}>
                      <th className="pr-2 text-right font-semibold text-neutral-500">
                        {classifier.labels[i]}
                      </th>
                      {row.map((v, j) => (
                        <td
                          key={j}
                          className={`border border-line px-2 py-1 ${
                            i === j && v > 0
                              ? "bg-linc-50 font-bold text-linc-700"
                              : v > 0
                                ? "text-rose-600"
                                : "text-neutral-300"
                          }`}
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="border-t border-line px-4 py-4">
        <h2 className="text-[15px] font-bold text-ink">2. BM25 ranking</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
          Ranks published posts for a search query such as &ldquo;Where can I ask about
          enrollment?&rdquo;. Compared with the PostgreSQL prefix full-text search used before.
        </p>
        {!search ? (
          <p className="mt-3 text-[13px] text-neutral-500">No evaluation yet. Run the search script.</p>
        ) : (
          <>
            <p className="mt-3 text-[12px] text-neutral-400">
              {search.queries} judged queries over {search.documents} posts, index build{" "}
              {search.indexBuildMs.toFixed(1)} ms, {formatDateTime(search.evaluatedAt)}
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left text-[12px]">
                <thead>
                  <tr className="border-y border-line text-[11px] uppercase tracking-wide text-neutral-400">
                    <th className="py-2 pr-3">Method</th>
                    {search.ks.map((k) => (
                      <th key={`p${k}`} className="px-2">{`P@${k}`}</th>
                    ))}
                    {search.ks.map((k) => (
                      <th key={`r${k}`} className="px-2">{`R@${k}`}</th>
                    ))}
                    <th className="px-2">Mean ms</th>
                    <th className="px-2">p95 ms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {Object.entries(search.summary).map(([name, s]) => (
                    <tr key={name}>
                      <td className="py-1.5 pr-3 font-medium uppercase text-ink">{name}</td>
                      {search.ks.map((k) => (
                        <td key={`p${k}`} className="px-2">
                          {s.precisionAtK[k].toFixed(3)}
                        </td>
                      ))}
                      {search.ks.map((k) => (
                        <td key={`r${k}`} className="px-2">
                          {s.recallAtK[k].toFixed(3)}
                        </td>
                      ))}
                      <td className="px-2">{s.meanMs.toFixed(3)}</td>
                      <td className="px-2">{s.p95Ms.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
