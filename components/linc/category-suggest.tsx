"use client";

import { useEffect, useState } from "react";

type Suggestion = {
  categoryId: string;
  label: string;
  confidence: number;
  alternatives: Array<{ categoryId: string; label: string }>;
};

/**
 * Reads the title and details fields as the user types and suggests a
 * category from the TF-IDF + SVM classifier. It never changes the choice by
 * itself; the user clicks a suggestion to apply it.
 */
export function CategorySuggest() {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [chosen, setChosen] = useState<string>("");

  useEffect(() => {
    const title = document.getElementById("title") as HTMLInputElement | null;
    const body = document.getElementById("body") as HTMLTextAreaElement | null;
    const select = document.getElementById("categoryId") as HTMLSelectElement | null;
    if (!title || !body || !select) return;

    let timer: number | undefined;
    let controller: AbortController | undefined;

    const run = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        controller?.abort();
        controller = new AbortController();
        try {
          const response = await fetch("/api/classify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: `${title.value}. ${body.value}` }),
            signal: controller.signal,
          });
          if (!response.ok) return;
          const data = (await response.json()) as { suggestion: Suggestion | null };
          setSuggestion(data.suggestion);
        } catch {
          // Aborted or offline: keep the previous suggestion.
        }
      }, 700);
    };

    const sync = () => setChosen(select.value);
    title.addEventListener("input", run);
    body.addEventListener("input", run);
    select.addEventListener("change", sync);
    return () => {
      window.clearTimeout(timer);
      controller?.abort();
      title.removeEventListener("input", run);
      body.removeEventListener("input", run);
      select.removeEventListener("change", sync);
    };
  }, []);

  function apply(categoryId: string) {
    const select = document.getElementById("categoryId") as HTMLSelectElement | null;
    if (!select) return;
    select.value = categoryId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const show = suggestion && suggestion.categoryId !== chosen;

  return (
    <div aria-live="polite" className="mt-2 min-h-[1px]">
      {show && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-neutral-500">
          <span>Suggested category:</span>
          {[
            { categoryId: suggestion.categoryId, label: suggestion.label },
            ...suggestion.alternatives,
          ].map((option, i) => (
            <button
              key={option.categoryId}
              type="button"
              onClick={() => apply(option.categoryId)}
              className={`rounded-full border px-2.5 py-0.5 font-semibold transition hover:bg-neutral-100 ${
                i === 0 ? "border-linc-300 text-linc-700" : "border-line text-neutral-600"
              }`}
            >
              {option.label}
              {i === 0 && ` · ${Math.round(suggestion.confidence * 100)}%`}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}
