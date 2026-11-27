import { describe, expect, it } from "vitest";
import { customTermsInstruction, SAFETY_SYSTEM_PROMPT } from "../lib/moderation/gemini";

describe("Gemini safety prompt", () => {
  it("covers both English and Filipino profanity", () => {
    expect(SAFETY_SYSTEM_PROMPT).toMatch(/English/);
    expect(SAFETY_SYSTEM_PROMPT).toMatch(/Filipino\/Tagalog/);
    expect(SAFETY_SYSTEM_PROMPT).toContain("putangina");
  });

  it("tells the model to review account names, not just posts", () => {
    expect(SAFETY_SYSTEM_PROMPT).toMatch(/account display names and usernames/i);
    expect(SAFETY_SYSTEM_PROMPT).toMatch(/signup/i);
  });

  it("tells the model to review comments and replies", () => {
    expect(SAFETY_SYSTEM_PROMPT).toMatch(/comments and replies/i);
  });

  it("asks for obfuscation detection and a stable severity scale", () => {
    expect(SAFETY_SYSTEM_PROMPT).toMatch(/obfuscations/i);
    expect(SAFETY_SYSTEM_PROMPT).toContain('"high"');
    expect(SAFETY_SYSTEM_PROMPT).toContain('"medium"');
    expect(SAFETY_SYSTEM_PROMPT).toContain('"low"');
    expect(SAFETY_SYSTEM_PROMPT).toContain('"none"');
  });
});

describe("administrator word filters in the Gemini prompt", () => {
  it("adds the admin filters to the instruction", () => {
    const instruction = customTermsInstruction(["skibidi", "putangina"]);
    expect(instruction).toContain('"skibidi"');
    expect(instruction).toContain('"putangina"');
    expect(instruction).toMatch(/administrator/i);
  });

  it("deduplicates filters without repeating the base prompt", () => {
    const instruction = customTermsInstruction(["Skibidi", "skibidi", "  "]);
    expect(instruction.match(/skibidi/gi)).toHaveLength(1);
  });

  it("returns nothing when there are no admin filters", () => {
    expect(customTermsInstruction([])).toBe("");
    expect(customTermsInstruction(["   "])).toBe("");
  });
});
