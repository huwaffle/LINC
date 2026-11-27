import { sqlite } from "./db/client";
import { AUTO_PREFIX, TOPICS, detectTopics } from "./topics";

/**
 * Creates a category for every topic that at least 3 published posts mention,
 * tags those posts with it, and drops auto categories that fall below the
 * threshold (and have no posts filed directly under them).
 */
export async function syncEmergingTopics(): Promise<string[]> {
  const posts = (
    await sqlite
      .prepare("select id, title || ' ' || body as text from entries where status = 'published'")
      .all() as Array<{ id: string; text: string }>
  );
  const hits = new Map(detectTopics(posts).map((h) => [h.topic.slug, h]));
  const created: string[] = [];

  await sqlite.transaction(async () => {
    const order = (await sqlite.prepare("select coalesce(max(sort_order), 0) as n from categories").get() as { n: number }).n;
    let next = order + 1;

    for (const topic of TOPICS) {
      const id = `${AUTO_PREFIX}${topic.slug}`;
      const hit = hits.get(topic.slug);
      const manual = await sqlite
        .prepare("select id from categories where slug = ? and id != ?")
        .get(topic.slug, id);
      if (manual) continue;

      if (hit) {
        const r = await sqlite
          .prepare("insert into categories (id, slug, label, description, sort_order) values (?, ?, ?, ?, ?) on conflict do nothing")
          .run(id, topic.slug, topic.label, topic.description, next++);
        if (r.changes) created.push(topic.slug);
        await sqlite.prepare("delete from entry_topics where category_id = ?").run(id);
        const tag = sqlite.prepare(
          "insert into entry_topics (entry_id, category_id) select id, ? from entries where id = ? and category_id != ? on conflict do nothing",
        );
        for (const postId of hit.postIds) await tag.run(id, postId, id);
      } else {
        const direct = await sqlite.prepare("select 1 from entries where category_id = ? limit 1").get(id);
        if (!direct) {
          await sqlite.prepare("delete from entry_topics where category_id = ?").run(id);
          await sqlite.prepare("delete from categories where id = ?").run(id);
        }
      }
    }
  });
  return created;
}
