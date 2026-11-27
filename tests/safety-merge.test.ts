import { describe, expect, it } from "vitest";
import { mergeAssessments } from "../lib/moderation/types";

describe("merging safety assessments", () => {
  it("keeps the more severe verdict and its explanation", () => {
    const merged = mergeAssessments(
      {
        severity: "none",
        categories: [],
        matchedTerms: [],
        explanation: "No issue.",
        provider: "gemini",
      },
      {
        severity: "medium",
        categories: ["admin filter"],
        matchedTerms: ["skibidi"],
        explanation: "Matched 1 administrator-added offensive term.",
        provider: "local",
      },
    );

    expect(merged.severity).toBe("medium");
    expect(merged.categories).toEqual(["admin filter"]);
    expect(merged.matchedTerms).toEqual(["skibidi"]);
    expect(merged.explanation).toContain("administrator");
    expect(merged.provider).toBe("gemini");
  });

  it("does not downgrade a stronger Gemini verdict", () => {
    const merged = mergeAssessments(
      {
        severity: "high",
        categories: ["threat"],
        matchedTerms: ["kill yourself"],
        explanation: "Targeted threat.",
        provider: "gemini",
      },
      {
        severity: "low",
        categories: ["profanity"],
        matchedTerms: ["damn"],
        explanation: "Mild profanity.",
        provider: "local",
      },
    );

    expect(merged.severity).toBe("high");
    expect(merged.explanation).toBe("Targeted threat.");
    expect(merged.matchedTerms).toEqual(["kill yourself", "damn"]);
  });

  it("deduplicates categories and terms", () => {
    const merged = mergeAssessments(
      {
        severity: "medium",
        categories: ["profanity"],
        matchedTerms: ["gago"],
        explanation: "Gemini result.",
        provider: "gemini",
      },
      {
        severity: "medium",
        categories: ["profanity", "admin filter"],
        matchedTerms: ["gago", "tanga"],
        explanation: "Local result.",
        provider: "local",
      },
    );

    expect(merged.categories).toEqual(["profanity", "admin filter"]);
    expect(merged.matchedTerms).toEqual(["gago", "tanga"]);
  });
});
