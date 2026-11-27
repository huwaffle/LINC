import type { SqliteDatabase } from "./client";
import { DUMMY_POSTS } from "./dummy-posts";
import { DEMO_ADMIN } from "../auth/demo-accounts";

const OFFICIAL = new Set(["announcements", "policies", "events", "services", "academic"]);

/**
 * Adds published demo posts until every category has at least `min` of them.
 * Safe to run repeatedly: a post is skipped when its title already exists.
 */
export async function topUpPosts(sqlite: SqliteDatabase, min = 10): Promise<number> {
  const categories = await sqlite.prepare("select id, slug from categories").all() as Array<{ id: string; slug: string }>;
  const students = await sqlite
    .prepare("select id from users where role = 'student' and is_anonymous = 0")
    .all() as Array<{ id: string }>;
  const admin = await sqlite.prepare("select id from users where id = ?").get(DEMO_ADMIN.id) as { id: string } | undefined;
  if (students.length === 0) return 0;

  const count = sqlite.prepare("select count(*) as n from entries where category_id = ? and status = 'published'");
  const exists = sqlite.prepare("select 1 from entries where title = ?");
  const insertEntry = sqlite.prepare(
    `insert into entries (id, author_id, category_id, title, body, status,
                          is_anonymous, reject_reason, created_at, updated_at)
     values (?, ?, ?, ?, ?, 'published', ?, null, ?, ?)`,
  );
  const insertLog = sqlite.prepare(
    `insert into moderation_log (id, entry_id, actor_id, from_status, to_status, reason, created_at)
     values (?, ?, ?, 'pending', 'published', null, ?)`,
  );
  const insertAnon = sqlite.prepare(
    `insert into users (id, username, role, display_name, is_anonymous, created_at)
     values (?, ?, 'student', 'Anonymous Lasallian', 1, ?)`,
  );
  const insertLike = sqlite.prepare(
    "insert into likes (id, entry_id, user_id, created_at) values (?, ?, ?, ?) on conflict do nothing",
  );
  const insertComment = sqlite.prepare(
    `insert into comments (id, entry_id, author_id, parent_id, body, is_anonymous, created_at)
     values (?, ?, ?, null, ?, 0, ?)`,
  );

  const COMMENTS = [
    "Thanks for sharing this!",
    "Same here, this really needs attention.",
    "Does anyone know more details about this?",
    "Great post, hope it gets noticed.",
    "Following this for updates.",
  ];

  let seq = Date.now();
  const id = (prefix: string) => `${prefix}-top-${(seq += 1).toString(36)}`;
  let added = 0;
  let pick = 0;

  await sqlite.transaction(async () => {
    for (const category of categories) {
      const posts = DUMMY_POSTS[category.slug] ?? [];
      let have = (await count.get(category.id) as { n: number }).n;

      for (const [title, body] of posts) {
        if (have >= min) break;
        if (await exists.get(title)) continue;

        pick += 1;
        const official = OFFICIAL.has(category.slug) && admin;
        const anonymous = category.slug === "freedom-wall" && pick % 2 === 0;
        let authorId = official ? admin!.id : students[pick % students.length].id;
        if (anonymous) {
          authorId = id("anon");
          await insertAnon.run(authorId, `anon-${authorId}`, Date.now());
        }

        const createdAt = Date.now() - (1 + ((pick * 7) % 28)) * 86_400_000 - ((pick * 977) % 80_000) * 1000;
        const entryId = id("entry");
        await insertEntry.run(
          entryId,
          authorId,
          category.id,
          title,
          body,
          anonymous ? 1 : 0,
          createdAt,
          createdAt + 3_600_000,
        );
        await insertLog.run(id("mod"), entryId, admin?.id ?? authorId, createdAt + 3_600_000);

        const likes = pick % 7;
        for (let i = 0; i < likes; i += 1) {
          await insertLike.run(id("like"), entryId, students[(pick + i * 3) % students.length].id, createdAt + 7_200_000);
        }
        if (pick % 3 === 0) {
          await insertComment.run(
            id("comment"),
            entryId,
            students[(pick + 5) % students.length].id,
            COMMENTS[pick % COMMENTS.length],
            createdAt + 10_800_000,
          );
        }

        have += 1;
        added += 1;
      }
    }
  });

  return added;
}
