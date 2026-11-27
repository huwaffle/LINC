import { seededRandom } from "./text";
import type { SparseVector } from "./tfidf";

export type SvmModel = {
  labels: string[];
  dimension: number;
  /** One weight vector (and bias) per label, one-vs-rest. */
  weights: number[][];
  bias: number[];
};

function dot(w: number[], x: SparseVector): number {
  let sum = 0;
  for (let k = 0; k < x.index.length; k += 1) sum += w[x.index[k]] * x.value[k];
  return sum;
}

/**
 * Linear SVM trained with Pegasos (stochastic sub-gradient descent on the
 * hinge loss with L2 regularisation), one-vs-rest for multi-class. Classes are
 * weighted inversely to their frequency so small categories are not ignored.
 */
export function trainSvm(
  vectors: SparseVector[],
  y: string[],
  dimension: number,
  options: { lambda?: number; epochs?: number; seed?: number } = {},
): SvmModel {
  const lambda = options.lambda ?? 0.0005;
  const epochs = options.epochs ?? 60;
  const random = seededRandom(options.seed ?? 7);
  const labels = [...new Set(y)].sort();
  const n = vectors.length;

  const weights: number[][] = [];
  const bias: number[] = [];

  for (const label of labels) {
    const positives = y.filter((v) => v === label).length;
    const posWeight = n / (2 * positives);
    const negWeight = n / (2 * (n - positives || 1));

    const w = new Array<number>(dimension).fill(0);
    let b = 0;
    let t = 0;

    for (let epoch = 0; epoch < epochs; epoch += 1) {
      const order = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }

      for (const idx of order) {
        t += 1;
        const eta = 1 / (lambda * (t + 10));
        const x = vectors[idx];
        const sign = y[idx] === label ? 1 : -1;
        const cw = sign === 1 ? posWeight : negWeight;
        const margin = sign * (dot(w, x) + b);

        const shrink = 1 - eta * lambda;
        for (let k = 0; k < dimension; k += 1) w[k] *= shrink;
        if (margin < 1) {
          for (let k = 0; k < x.index.length; k += 1) w[x.index[k]] += eta * cw * sign * x.value[k];
          b += eta * cw * sign * 0.1;
        }
      }
    }
    weights.push(w);
    bias.push(b);
  }

  return { labels, dimension, weights, bias };
}

/** Raw decision values per label; the predicted label is the largest. */
export function decision(model: SvmModel, x: SparseVector): Array<{ label: string; score: number }> {
  return model.labels
    .map((label, i) => ({ label, score: dot(model.weights[i], x) + model.bias[i] }))
    .sort((a, b) => b.score - a.score);
}
