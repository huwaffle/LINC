import { describe, expect, it } from "vitest";
import { mentionKeys, splitMentions } from "../lib/mentions";

const users = new Map([
  ["student 1001", { username: "20201001" }],
  ["maria", { username: "20201002" }],
]);

describe("mentions", () => {
  it("resolves multi-word nicknames, preferring the longest match", () => {
    const parts = splitMentions("thanks @Student 1001, see you", users);
    expect(parts).toEqual([
      { type: "text", text: "thanks " },
      { type: "mention", text: "@Student 1001", username: "20201001" },
      { type: "text", text: ", see you" },
    ]);
  });

  it("falls back to a shorter run and ignores unknown names and emails", () => {
    const parts = splitMentions("@maria is right, mail me@maria.com or @nobody", users);
    expect(parts.filter((p) => p.type === "mention")).toHaveLength(1);
  });

  it("collects lookup keys for every candidate length", () => {
    expect(mentionKeys(["hi @Student 1001 ok"])).toContain("student 1001");
    expect(mentionKeys(["hi @Student 1001 ok"])).toContain("student");
  });
});
