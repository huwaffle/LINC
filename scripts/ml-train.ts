import fs from "node:fs";
import path from "node:path";
import {
  crossValidate,
  EVAL_PATH,
  loadDataset,
  MODEL_PATH,
  trainClassifier,
} from "../lib/ml/classifier";

const examples = loadDataset();
const report = crossValidate(examples, 5);

const pct = (n: number) => `${(n * 100).toFixed(1)}%`.padStart(6);
console.log(`TF-IDF + linear SVM, stratified 5-fold cross-validation on ${examples.length} labeled submissions\n`);
console.log("category".padEnd(14), "precision", "recall", "  f1", "  support");
for (const c of report.perClass) {
  console.log(c.label.padEnd(14), pct(c.precision).padStart(9), pct(c.recall), pct(c.f1), String(c.support).padStart(8));
}
console.log("\naccuracy".padEnd(15), pct(report.accuracy));
console.log("macro avg".padEnd(14), pct(report.macro.precision).padStart(9), pct(report.macro.recall), pct(report.macro.f1));
console.log("weighted avg".padEnd(14), pct(report.weighted.precision).padStart(9), pct(report.weighted.recall), pct(report.weighted.f1));

console.log("\nconfusion matrix (rows = actual, columns = predicted)");
console.log("".padEnd(14), report.labels.map((l) => l.slice(0, 6).padStart(7)).join(""));
report.confusion.forEach((row, i) => {
  console.log(report.labels[i].padEnd(14), row.map((v) => String(v).padStart(7)).join(""));
});

fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
fs.writeFileSync(MODEL_PATH, JSON.stringify(trainClassifier(examples)));
fs.writeFileSync(EVAL_PATH, JSON.stringify({ ...report, folds: 5, evaluatedAt: Date.now() }, null, 2));
console.log(`\nModel written to ${path.relative(process.cwd(), MODEL_PATH)}`);
