import { describe, expect, it } from "vitest";
import { buildProfile, rank, type Candidate, type Signal } from "../lib/recommend/engine";

const now = Date.UTC(2026, 0, 10);
const day = 86_400_000;
const signal = (kind: Signal["kind"], categoryId: string, text: string, ageDays = 1): Signal => ({
  kind, categoryId, text, at: now - ageDays * day,
});
const post = (id: string, categoryId: string, text: string, ageDays = 1): Candidate => ({
  id, categoryId, text, createdAt: now - ageDays * day, engagement: 0,
});

describe("recommendation engine", () => {
  const candidates = [
    post("sports", "sports", "Basketball tryouts and intramurals schedule"),
    post("code", "tech", "Programming workshop: learn Python and coding basics"),
    post("misc", "misc", "Cafeteria menu update"),
  ];

  it("has no profile signal without history", () => {
    expect(buildProfile([], now).total).toBe(0);
  });

  it("promotes programming content for a programmer", () => {
    const profile = buildProfile(
      [signal("like", "tech", "Python coding contest"), signal("save", "tech", "Programming bootcamp")],
      now,
    );
    expect(rank(candidates, profile, { now })[0].item.id).toBe("code");
  });

  it("promotes sports content for a sports fan", () => {
    const profile = buildProfile(
      [signal("view", "sports", "Basketball finals"), signal("like", "sports", "Volleyball intramurals")],
      now,
    );
    expect(rank(candidates, profile, { now })[0].item.id).toBe("sports");
  });

  it("weights deliberate actions and recent signals higher", () => {
    const profile = buildProfile(
      [signal("save", "a", "x", 1), signal("view", "b", "y", 1), signal("save", "c", "z", 60)],
      now,
    );
    expect(profile.categories.get("a")!).toBeGreaterThan(profile.categories.get("b")!);
    expect(profile.categories.get("b")!).toBeGreaterThan(profile.categories.get("c")!);
  });

  it("demotes already-seen posts and diversifies categories", () => {
    const profile = buildProfile([signal("like", "tech", "coding python")], now);
    const pool = [
      { ...post("t1", "tech", "python coding one"), seen: true },
      post("t2", "tech", "python coding two"),
      post("t3", "tech", "python coding three"),
      post("m1", "misc", "python coding other"),
    ];
    const order = rank(pool, profile, { now }).map((r) => r.item.id);
    expect(order[order.length - 1]).toBe("t1");
    expect(order.indexOf("m1")).toBeLessThan(order.indexOf("t1"));
  });
});
