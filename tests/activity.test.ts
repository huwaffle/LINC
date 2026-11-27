import { describe, expect, it } from "vitest";
import {
  activityCounts,
  activityDetail,
  activityHeadline,
  buildActivityFeed,
  filterActivity,
  type ActivityRecord,
} from "../lib/activity";

function record(overrides: Partial<ActivityRecord>): ActivityRecord {
  return {
    id: "like:entry-1",
    kind: "like",
    entry_id: "entry-1",
    entry_title: "Shuttle schedule update",
    entry_status: "published",
    category_slug: "concerns",
    created_at: 1_000,
    count: 1,
    latest_actor: "Student 1001",
    detail: null,
    status: null,
    reason: null,
    ...overrides,
  };
}

describe("activity formatting", () => {
  it("compiles multiple likes into one reaction count", () => {
    expect(activityHeadline(record({ count: 20 }))).toBe("20 likes on your post");
  });

  it("names the actor for a single reaction", () => {
    expect(activityHeadline(record({ count: 1 }))).toBe("Student 1001 liked your post");
  });

  it("compiles reposts and replies per post", () => {
    expect(activityHeadline(record({ kind: "repost", count: 4 }))).toBe(
      "4 reposts of your post",
    );
    expect(activityHeadline(record({ kind: "comment", count: 3 }))).toBe(
      "3 replies on your post",
    );
  });

  it("shows the latest reply as a quoted excerpt", () => {
    expect(
      activityDetail(
        record({ kind: "comment", detail: "Is there an update for the evening shift?" }),
      ),
    ).toBe("“Is there an update for the evening shift?”");
  });

  it("turns moderation history into post tracking", () => {
    expect(activityHeadline(record({ kind: "moderation", status: "published" }))).toBe(
      "Your post is now published",
    );
    expect(
      activityDetail(
        record({ kind: "moderation", status: "rejected", reason: "Off-topic for this category." }),
      ),
    ).toBe("Reason: Off-topic for this category.");
  });
});

describe("activity grouping", () => {
  it("collapses likes and reposts on one post into a single row", () => {
    const items = buildActivityFeed({
      incoming: [
        record({ id: "like:e1", kind: "like", count: 5, created_at: 2_000 }),
        record({ id: "repost:e1", kind: "repost", count: 2, created_at: 1_000 }),
      ],
      outgoing: [],
      notifications: [],
    });
    expect(items).toHaveLength(1);
    expect(items[0].headline).toBe("5 likes and 2 reposts on your post");
  });

  it("counts unread items per tab", () => {
    const items = buildActivityFeed({
      incoming: [],
      outgoing: [],
      notifications: [
        { id: "n1", kind: "mention", subject: "x", body: "", href: null, created_at: 1, read_at: null },
        { id: "n2", kind: "system", subject: "y", body: "", href: null, created_at: 2, read_at: null },
        { id: "n3", kind: "system", subject: "z", body: "", href: null, created_at: 3, read_at: 9 },
      ],
    });
    const counts = activityCounts(items);
    expect(counts.all.unread).toBe(2);
    expect(counts.reactions.unread).toBe(1);
    expect(counts.notices.unread).toBe(1);
    expect(filterActivity(items, "notices")).toHaveLength(2);
  });
});
