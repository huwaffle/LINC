import { describe, expect, it } from "vitest";
import { Bm25Index } from "../lib/ml/bm25";
import { crossValidate, loadDataset, predictCategory, trainClassifier } from "../lib/ml/classifier";
import { classificationReport, precisionAtK, recallAtK } from "../lib/ml/metrics";
import { fitTfidf, transformTfidf } from "../lib/ml/tfidf";

describe("BM25", () => {
  const index = new Bm25Index([
    { id: "a", title: "Enrollment for the second semester opens", body: "Students may enroll at the registrar." },
    { id: "b", title: "Library hours", body: "The library is open late during finals." },
    { id: "c", title: "Lost wallet", body: "A black wallet was found near the cafeteria." },
  ]);

  it("ranks a natural-language question by its content words", () => {
    expect(index.search("Where can I ask about enrollment?")[0].id).toBe("a");
  });

  it("returns nothing when no term matches", () => {
    expect(index.search("zebra")).toEqual([]);
  });

  it("matches simple word forms", () => {
    expect(index.search("enrolling")[0]?.id).toBe("a");
  });
});

describe("TF-IDF", () => {
  it("produces L2-normalised vectors", () => {
    const model = fitTfidf(["lost wallet found", "library hours extended", "wallet reward"]);
    const v = transformTfidf(model, "lost wallet");
    expect(Math.sqrt(v.value.reduce((s, x) => s + x * x, 0))).toBeCloseTo(1, 6);
  });
});

describe("SVM classifier", () => {
  const examples = loadDataset();
  const model = trainClassifier(examples);

  it("fits its training data well", () => {
    const correct = examples.filter((e) => predictCategory(model, e.text).label === e.label).length;
    expect(correct / examples.length).toBeGreaterThan(0.9);
  });

  it("classifies clear examples", () => {
    expect(predictCategory(model, "Found a black wallet near the canteen, please claim it").label).toBe(
      "lost-found",
    );
    expect(predictCategory(model, "Selling my pre-loved textbooks, price negotiable").label).toBe(
      "marketplace",
    );
  });

  it("beats random guessing under cross-validation", () => {
    const report = crossValidate(examples, 5);
    expect(report.accuracy).toBeGreaterThan(2 / report.labels.length);
  });
});

describe("metrics", () => {
  it("computes precision, recall, F1 and the confusion matrix", () => {
    const r = classificationReport(["a", "a", "b", "b"], ["a", "b", "b", "b"]);
    expect(r.confusion).toEqual([
      [1, 1],
      [0, 2],
    ]);
    const a = r.perClass.find((c) => c.label === "a")!;
    expect(a.precision).toBe(1);
    expect(a.recall).toBe(0.5);
    expect(a.f1).toBeCloseTo(2 / 3, 6);
    expect(r.accuracy).toBe(0.75);
  });

  it("computes Precision@k and Recall@k", () => {
    const relevant = new Set(["x", "y"]);
    expect(precisionAtK(["x", "z", "y"], relevant, 3)).toBeCloseTo(2 / 3, 6);
    expect(recallAtK(["x", "z", "y"], relevant, 1)).toBe(0.5);
  });
});
