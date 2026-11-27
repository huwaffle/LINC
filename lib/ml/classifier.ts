import fs from "node:fs";
import path from "node:path";
import { classificationReport, type ClassificationReport } from "./metrics";
import { decision, trainSvm, type SvmModel } from "./svm";
import { fitTfidf, transformTfidf, type TfidfModel } from "./tfidf";
import { seededRandom } from "./text";

export type Example = { text: string; label: string };

export type CategoryModel = { tfidf: TfidfModel; svm: SvmModel; trainedOn: number; trainedAt: number };

export type Prediction = {
  label: string;
  /** Margin between the best and second-best decision values, squashed to 0..1. */
  confidence: number;
  scores: Array<{ label: string; score: number }>;
};

export const DATASET_PATH = path.join(process.cwd(), "data", "ml", "labeled-submissions.json");
export const MODEL_PATH = path.join(process.cwd(), "storage", "models", "category-classifier.json");
export const EVAL_PATH = path.join(process.cwd(), "storage", "models", "category-evaluation.json");

export function loadDataset(): Example[] {
  const raw = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8")) as Record<string, string[]>;
  return Object.entries(raw).flatMap(([label, texts]) => texts.map((text) => ({ text, label })));
}

export function trainClassifier(examples: Example[]): CategoryModel {
  const tfidf = fitTfidf(examples.map((e) => e.text));
  const vectors = examples.map((e) => transformTfidf(tfidf, e.text));
  const svm = trainSvm(vectors, examples.map((e) => e.label), tfidf.idf.length);
  return { tfidf, svm, trainedOn: examples.length, trainedAt: Date.now() };
}

export function predictCategory(model: CategoryModel, text: string): Prediction {
  const scores = decision(model.svm, transformTfidf(model.tfidf, text));
  const margin = scores.length > 1 ? scores[0].score - scores[1].score : scores[0].score;
  return { label: scores[0].label, confidence: 1 / (1 + Math.exp(-3 * margin)), scores };
}

/** Stratified k-fold cross-validation: every example is predicted by a model that never saw it. */
export function crossValidate(examples: Example[], folds = 5, seed = 42): ClassificationReport {
  const random = seededRandom(seed);
  const byLabel = new Map<string, Example[]>();
  for (const e of examples) byLabel.set(e.label, [...(byLabel.get(e.label) ?? []), e]);

  const assigned: Example[][] = Array.from({ length: folds }, () => []);
  for (const group of byLabel.values()) {
    const shuffled = [...group].sort(() => random() - 0.5);
    shuffled.forEach((e, i) => assigned[i % folds].push(e));
  }

  const actual: string[] = [];
  const predicted: string[] = [];
  for (let f = 0; f < folds; f += 1) {
    const model = trainClassifier(assigned.filter((_, i) => i !== f).flat());
    for (const e of assigned[f]) {
      actual.push(e.label);
      predicted.push(predictCategory(model, e.text).label);
    }
  }
  return classificationReport(actual, predicted, [...byLabel.keys()].sort());
}

let cached: CategoryModel | null = null;

/** Uses the model written by `npm run ml:train`, or trains from the dataset on first use. */
export function getClassifier(): CategoryModel {
  if (cached) return cached;
  cached = fs.existsSync(MODEL_PATH)
    ? (JSON.parse(fs.readFileSync(MODEL_PATH, "utf8")) as CategoryModel)
    : trainClassifier(loadDataset());
  return cached;
}
