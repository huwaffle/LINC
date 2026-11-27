export type ClassReport = { label: string; precision: number; recall: number; f1: number; support: number };

export type ClassificationReport = {
  labels: string[];
  /** matrix[actual][predicted] */
  confusion: number[][];
  perClass: ClassReport[];
  accuracy: number;
  macro: { precision: number; recall: number; f1: number };
  weighted: { precision: number; recall: number; f1: number };
  total: number;
};

const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);

export function classificationReport(
  actual: string[],
  predicted: string[],
  labels?: string[],
): ClassificationReport {
  const all = labels ?? [...new Set([...actual, ...predicted])].sort();
  const at = new Map(all.map((l, i) => [l, i]));
  const confusion = all.map(() => all.map(() => 0));
  actual.forEach((a, i) => {
    confusion[at.get(a)!][at.get(predicted[i])!] += 1;
  });

  const perClass = all.map((label, i) => {
    const tp = confusion[i][i];
    const fp = confusion.reduce((s, row, r) => s + (r === i ? 0 : row[i]), 0);
    const fn = confusion[i].reduce((s, v, c) => s + (c === i ? 0 : v), 0);
    const precision = ratio(tp, tp + fp);
    const recall = ratio(tp, tp + fn);
    return {
      label,
      precision,
      recall,
      f1: ratio(2 * precision * recall, precision + recall),
      support: tp + fn,
    };
  });

  const total = actual.length;
  const mean = (key: "precision" | "recall" | "f1", weighted: boolean) =>
    perClass.reduce((s, c) => s + c[key] * (weighted ? c.support : 1), 0) /
    (weighted ? Math.max(1, total) : Math.max(1, perClass.length));

  return {
    labels: all,
    confusion,
    perClass,
    accuracy: ratio(actual.filter((a, i) => a === predicted[i]).length, total),
    macro: { precision: mean("precision", false), recall: mean("recall", false), f1: mean("f1", false) },
    weighted: { precision: mean("precision", true), recall: mean("recall", true), f1: mean("f1", true) },
    total,
  };
}

/** Fraction of the top-k results that are relevant. */
export function precisionAtK(ranked: string[], relevant: Set<string>, k: number): number {
  return ranked.slice(0, k).filter((id) => relevant.has(id)).length / k;
}

/** Fraction of all relevant records found in the top k. */
export function recallAtK(ranked: string[], relevant: Set<string>, k: number): number {
  return relevant.size === 0 ? 0 : ranked.slice(0, k).filter((id) => relevant.has(id)).length / relevant.size;
}
