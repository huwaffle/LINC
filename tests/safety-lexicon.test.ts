import { describe, expect, it } from "vitest";
import {
  normalizeCustomTerm,
  normalizeForScan,
  scanAdminTerms,
  scanWithLexicon,
} from "../lib/moderation/lexicon";

describe("offline safety lexicon", () => {
  it("finds plain profanity and reports its severity", () => {
    const result = scanWithLexicon("This update is shit and everyone knows it.");
    expect(result.severity).toBe("medium");
    expect(result.matchedTerms).toContain("shit");
    expect(result.categories).toContain("profanity");
    expect(result.provider).toBe("local");
  });

  it("normalizes leetspeak and stretched letters", () => {
    expect(normalizeForScan("sh1t")).toBe("shit");
    expect(scanWithLexicon("That is sh1t.").matchedTerms).toContain("shit");
    expect(scanWithLexicon("What the fuuuck.").matchedTerms).toContain("fuck");
  });

  it("recognizes Filipino profanity used on campus", () => {
    const result = scanWithLexicon("Putangina, gago talaga.");
    expect(result.severity).toBe("medium");
    expect(result.matchedTerms).toEqual(expect.arrayContaining(["putangina", "gago"]));
  });

  it("recognizes a broader set of Filipino profanity", () => {
    const result = scanWithLexicon("Pota, ang kupal at siraulo niyang ugali. Tanginamo!");
    expect(result.severity).toBe("medium");
    expect(result.matchedTerms).toEqual(
      expect.arrayContaining(["pota", "kupal", "siraulo", "tanginamo"]),
    );
  });

  it("recognizes obfuscated Filipino profanity", () => {
    expect(scanWithLexicon("g4go ka talaga").matchedTerms).toContain("gago");
    expect(scanWithLexicon("puuutangina").matchedTerms).toContain("putangina");
  });

  it("recognizes Filipino threats as high risk", () => {
    expect(scanWithLexicon("Papatayin kita kapag nagpakita ka pa.").severity).toBe("high");
    expect(scanWithLexicon("Sasaksakin kita.").matchedTerms).toContain("sasaksakin kita");
  });

  it("escalates threats and slurs to high risk", () => {
    expect(scanWithLexicon("Just kill yourself.").severity).toBe("high");
    expect(scanWithLexicon("That slur is not acceptable.").severity).toBe("none");
  });

  it("does not match inside ordinary words", () => {
    const result = scanWithLexicon("The classic assignment schedule is available.");
    expect(result.severity).toBe("none");
    expect(result.matchedTerms).toEqual([]);
    expect(scanWithLexicon("Hello, class.").severity).toBe("none");
  });

  it("returns a clean assessment for ordinary text", () => {
    const result = scanWithLexicon("The student organization meeting starts at noon.");
    expect(result).toMatchObject({
      severity: "none",
      categories: [],
      matchedTerms: [],
      provider: "local",
    });
  });

  it("applies administrator filters on top of the built-in list", () => {
    const rules = [{ term: "skibidi", severity: "medium" as const, category: "admin filter" }];
    const result = scanWithLexicon("That skibidi take is nonsense.", rules);
    expect(result.severity).toBe("medium");
    expect(result.matchedTerms).toContain("skibidi");
    expect(result.categories).toContain("admin filter");
    expect(scanWithLexicon("That take is nonsense.").severity).toBe("none");
  });

  it("normalizes administrator terms and matches them case-insensitively", () => {
    expect(normalizeCustomTerm("  Putang   Ina  ")).toBe("Putang Ina");
    const rules = [{ term: "Putang Ina", severity: "high" as const, category: "admin filter" }];
    expect(scanAdminTerms("PUTANG INA talaga.", rules).severity).toBe("high");
    expect(scanAdminTerms("putang ina talaga.", rules).matchedTerms).toContain("Putang Ina");
  });

  it("only reports administrator filters when asked for them", () => {
    const rules = [{ term: "custombadword", severity: "low" as const, category: "admin filter" }];
    expect(scanAdminTerms("This is custombadword.", rules).severity).toBe("low");
    expect(scanAdminTerms("This is shit.", rules).severity).toBe("none");
    expect(scanAdminTerms("This is clean.", rules).severity).toBe("none");
  });
});
