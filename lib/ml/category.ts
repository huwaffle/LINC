import { sqlite } from "../db/client";
import { getClassifier, predictCategory } from "./classifier";

export type CategoryDecision = {
  categoryId: string;
  label: string;
  /** assigned: none was chosen and the classifier picked one; kept: the user's choice stands. */
  action: "assigned" | "kept";
};

type Row = { id: string; slug: string; label: string };

/**
 * Picks the category for a post. Only an empty choice is filled in, using the
 * TF-IDF + SVM prediction. A category the user chose is never changed.
 */
export async function decideCategory(text: string, chosenId: string | null | undefined): Promise<CategoryDecision | null> {
  const rows = await sqlite.prepare("select id, slug, label from categories").all() as Row[];
  const chosen = chosenId ? rows.find((row) => row.id === chosenId) : undefined;
  if (chosenId && !chosen) return null;

  const prediction = predictCategory(getClassifier(), text);
  const predicted = rows.find((row) => row.slug === prediction.label);

  if (!chosen) {
    return predicted ? { categoryId: predicted.id, label: predicted.label, action: "assigned" } : null;
  }
  return { categoryId: chosen.id, label: chosen.label, action: "kept" };
}

export function decisionNote(decision: CategoryDecision): string | null {
  if (decision.action === "assigned") return `Category chosen automatically: ${decision.label}.`;
  return null;
}
