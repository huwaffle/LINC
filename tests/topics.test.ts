import { describe, expect, it } from "vitest";
import { detectTopics } from "../lib/topics";

const post = (id: string, text: string) => ({ id, text });

describe("emerging topics", () => {
  it("creates Sports once 3 posts mention sports terms", () => {
    const posts = [
      post("1", "Basketball tryouts this Friday"),
      post("2", "Volleyball intramurals schedule"),
      post("3", "Who won the basketball game?"),
      post("4", "Cafeteria menu"),
    ];
    const hits = detectTopics(posts);
    expect(hits.map((h) => h.topic.slug)).toEqual(["sports"]);
    expect(hits[0].postIds).toEqual(["1", "2", "3"]);
  });

  it("stays quiet below the threshold", () => {
    expect(detectTopics([post("1", "basketball"), post("2", "basketball")])).toEqual([]);
  });
});
