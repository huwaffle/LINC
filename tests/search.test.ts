import { describe, expect, it } from "vitest";
import { didYouMean, highlightParts, toFtsQuery, tokenizeQuery, vocabularyOf } from "../lib/search";

describe("search helpers", () => {
  it("splits hyphenated words instead of gluing them", () => {
    expect(tokenizeQuery("pre-loved bags")).toEqual(["pre", "loved", "bags"]);
    expect(toFtsQuery("pre-loved")).toBe('"pre"* AND "loved"*');
  });

  it("can build a loose OR query and ignores punctuation-only input", () => {
    expect(toFtsQuery("shuttle, schedule", "any")).toBe('"shuttle"* OR "schedule"*');
    expect(toFtsQuery("?!")).toBeNull();
  });

  it("suggests the closest known word for a typo", () => {
    const vocab = vocabularyOf(["Shuttle schedule update", "Pre-loved books"]);
    expect(didYouMean("shutle", vocab)).toBe("shuttle");
    expect(didYouMean("shuttle", vocab)).toBeNull();
    expect(didYouMean("zzzzzz", vocab)).toBeNull();
  });

  it("highlights prefix and stem matches", () => {
    const parts = highlightParts("Pre-loved books", ["pre", "loved"]);
    expect(parts.filter((p) => p.match).map((p) => p.text)).toEqual(["Pre", "loved"]);
    expect(highlightParts("I love it", ["loved"]).some((p) => p.match && p.text === "love")).toBe(true);
  });
});
