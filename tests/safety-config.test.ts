import { afterEach, describe, expect, it, vi } from "vitest";
import { meetsSeverity, safetyConfig } from "../lib/moderation/config";

const SETTINGS = [
  "SAFETY_FLAG_MIN_SEVERITY",
  "SAFETY_NOTIFY_MIN_SEVERITY",
  "SAFETY_INCLUDE_DRAFTS",
  "SAFETY_ATTRIBUTE_ANONYMOUS",
  "SAFETY_GEMINI_MODE",
  "SAFETY_BATCH_SIZE",
  "SAFETY_MAX_CHARS_PER_ITEM",
  "SAFETY_TIMEOUT_MS",
] as const;

function clearSettings(): void {
  for (const name of SETTINGS) vi.stubEnv(name, "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("safety scanning config", () => {
  it("uses the recommended defaults", () => {
    clearSettings();
    expect(safetyConfig()).toMatchObject({
      flagMinSeverity: "low",
      notifyMinSeverity: "medium",
      includeDrafts: false,
      attributeAnonymous: false,
      geminiMode: "authoritative",
      batchSize: 40,
      maxCharsPerItem: 6_000,
      timeoutMs: 60_000,
    });
  });

  it("reads overrides from the environment", () => {
    clearSettings();
    vi.stubEnv("SAFETY_FLAG_MIN_SEVERITY", "medium");
    vi.stubEnv("SAFETY_NOTIFY_MIN_SEVERITY", "high");
    vi.stubEnv("SAFETY_INCLUDE_DRAFTS", "true");
    vi.stubEnv("SAFETY_ATTRIBUTE_ANONYMOUS", "yes");
    vi.stubEnv("SAFETY_GEMINI_MODE", "combine");
    vi.stubEnv("SAFETY_BATCH_SIZE", "5");
    vi.stubEnv("SAFETY_MAX_CHARS_PER_ITEM", "1200");
    vi.stubEnv("SAFETY_TIMEOUT_MS", "45000");

    expect(safetyConfig()).toMatchObject({
      flagMinSeverity: "medium",
      notifyMinSeverity: "high",
      includeDrafts: true,
      attributeAnonymous: true,
      geminiMode: "combine",
      batchSize: 5,
      maxCharsPerItem: 1_200,
      timeoutMs: 45_000,
    });
  });

  it("falls back when a value is invalid and clamps numeric limits", () => {
    clearSettings();
    vi.stubEnv("SAFETY_FLAG_MIN_SEVERITY", "none");
    vi.stubEnv("SAFETY_INCLUDE_DRAFTS", "maybe");
    vi.stubEnv("SAFETY_BATCH_SIZE", "not-a-number");
    vi.stubEnv("SAFETY_TIMEOUT_MS", "99");

    expect(safetyConfig()).toMatchObject({
      flagMinSeverity: "low",
      includeDrafts: false,
      batchSize: 40,
      timeoutMs: 1_000,
    });
  });

  it("compares severities including none", () => {
    expect(meetsSeverity("none", "low")).toBe(false);
    expect(meetsSeverity("low", "low")).toBe(true);
    expect(meetsSeverity("medium", "low")).toBe(true);
    expect(meetsSeverity("medium", "high")).toBe(false);
    expect(meetsSeverity("high", "medium")).toBe(true);
  });
});
