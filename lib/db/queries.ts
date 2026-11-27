import { sqlite } from "./client";
import type { ActivityRecord, OutgoingActivityRecord } from "../activity";
import type { AttachmentFile } from "../attachments";
import type { EntryStatus } from "./schema";
import { Bm25Index } from "../ml/bm25";
import { mentionKeys } from "../mentions";
import { didYouMean, toTsQuery, vocabularyOf } from "../search";

export type EntryRecord = {
  id: string;
  title: string;
  body: string;
  status: EntryStatus;
  is_anonymous: number;
  created_at: number;
  updated_at: number;
  reject_reason: string | null;
  category_id: string;
  category_label: string;
  category_slug: string;
  author_id: string;
  author_name: string;
  author_username: string;
  author_has_avatar: number;
  comment_count: number;
  like_count: number;
  repost_count: number;
  viewer_has_liked?: boolean;
  viewer_has_saved?: boolean;
  viewer_has_reposted?: boolean;
  /** Media attached to the post, filled by `attachAttachments`. */
  media?: AttachmentFile[];
};

export const ENTRY_SELECT = `
  select e.id, e.title, e.body, e.status, e.is_anonymous, e.created_at, e.updated_at,
         e.reject_reason, e.category_id, c.label as category_label, c.slug as category_slug,
         e.author_id, u.display_name as author_name, u.username as author_username,
         case when u.is_anonymous = 0 and u.avatar_path is not null then 1 else 0 end
           as author_has_avatar,
         (select count(*) from comments cm where cm.entry_id = e.id) as comment_count,
         (select count(*) from likes l where l.entry_id = e.id) as like_count,
         (select count(*) from reposts rp where rp.entry_id = e.id) as repost_count
  from entries e
  join categories c on c.id = e.category_id
  join users u on u.id = e.author_id
`;

export const PAGE_SIZE = 20;

export type Page<T> = { items: T[]; nextCursor: string | null };

type SortedEntry = EntryRecord & { sort_ts?: number };

function decodeCursor(cursor?: string | null): { ts: number; id: string } | null {
  if (!cursor) return null;
  const at = cursor.indexOf("_");
  const ts = Number(cursor.slice(0, at));
  const id = cursor.slice(at + 1);
  return at > 0 && Number.isFinite(ts) && id ? { ts, id } : null;
}

/**
 * Keyset pagination over (timestamp, entry id). A cursor stays valid when rows
 * are added or removed, so a "Load more" never skips or repeats a post.
 */
async function pageEntries(options: {
  joins?: string;
  where: string[];
  params: unknown[];
  tsColumn?: string;
  limit?: number;
  cursor?: string | null;
}): Promise<Page<EntryRecord>> {
  const ts = options.tsColumn ?? "e.created_at";
  const limit = options.limit ?? PAGE_SIZE;
  const where = [...options.where];
  const params = [...options.params];
  const cursor = decodeCursor(options.cursor);
  if (cursor) {
    where.push(`(${ts} < ? or (${ts} = ? and e.id < ?))`);
    params.push(cursor.ts, cursor.ts, cursor.id);
  }

  const rows = await sqlite
    .prepare(
      `${ENTRY_SELECT.replace("select ", `select ${ts} as sort_ts, `)} ${options.joins ?? ""}
       where ${where.join(" and ")} order by ${ts} desc, e.id desc limit ?`,
    )
    .all(...params, limit + 1) as SortedEntry[];

  const more = rows.length > limit;
  const items = more ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: more && last ? `${last.sort_ts}_${last.id}` : null,
  };
}

export type CategoryRecord = {
  id: string;
  slug: string;
  label: string;
  description: string;
  total: number;
};

export async function listCategories(): Promise<CategoryRecord[]> {
  return await sqlite
    .prepare(
      `select c.id, c.slug, c.label, c.description,
              (select count(*) from entries e where e.status = 'published' and (e.category_id = c.id or e.id in (select entry_id from entry_topics t where t.category_id = c.id))) as total
       from categories c
       order by c.sort_order asc`,
    )
    .all() as CategoryRecord[];
}

/** Categories whose label or slug matches the typed text (case-insensitive, partial). */
export async function searchCategories(query: string): Promise<CategoryRecord[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return (await listCategories()).filter((c) => {
    const label = c.label.toLowerCase();
    return label.includes(q) || c.slug.toLowerCase().includes(q) || q.includes(label);
  });
}

export async function getCategoryBySlug(slug: string): Promise<CategoryRecord | undefined> {
  return await sqlite
    .prepare(
      `select c.id, c.slug, c.label, c.description,
              (select count(*) from entries e where e.status = 'published' and (e.category_id = c.id or e.id in (select entry_id from entry_topics t where t.category_id = c.id))) as total
       from categories c where c.slug = ?`,
    )
    .get(slug) as CategoryRecord | undefined;
}

export async function listPublishedEntries(options: {
  categorySlug?: string;
  limit?: number;
  cursor?: string | null;
} = {}): Promise<Page<EntryRecord>> {
  const where: string[] = ["e.status = 'published'"];
  const params: unknown[] = [];

  if (options.categorySlug) {
    where.push(
      "(c.slug = ? or e.id in (select t.entry_id from entry_topics t join categories tc on tc.id = t.category_id where tc.slug = ?))",
    );
    params.push(options.categorySlug, options.categorySlug);
  }

  return await pageEntries({ where, params, limit: options.limit, cursor: options.cursor });
}

export async function getEntry(id: string): Promise<EntryRecord | undefined> {
  return await sqlite.prepare(`${ENTRY_SELECT} where e.id = ?`).get(id) as EntryRecord | undefined;
}

/** Minimal row used for authorization decisions. */
export async function getEntryScope(
  id: string,
): Promise<{ id: string; status: EntryStatus } | undefined> {
  const row = await sqlite
    .prepare("select id, status from entries where id = ?")
    .get(id) as { id: string; status: EntryStatus } | undefined;
  return row;
}

export type SearchResult = EntryRecord & { rank: number };

export type SearchSort = "relevance" | "newest" | "liked" | "discussed";

export type SearchOptions = {
  categoryId?: string;
  /** Inclusive lower bound on the post timestamp. */
  from?: number;
  /** Inclusive upper bound on the post timestamp. */
  to?: number;
  sort?: SearchSort;
};

/** ORDER BY fragments are a fixed whitelist, never interpolated from input. */
const SEARCH_ORDER: Record<SearchSort, string> = {
  relevance: "rank desc",
  newest: "e.created_at desc",
  liked: "like_count desc, e.created_at desc",
  discussed: "comment_count desc, e.created_at desc",
};

let bm25Cache: { key: string; index: Bm25Index } | null = null;

/** BM25 index over published posts, rebuilt only when a post is added or changed. */
export async function getSearchIndex(): Promise<Bm25Index> {
  const stamp = await sqlite
    .prepare("select count(*) as n, coalesce(max(updated_at), 0) as m from entries where status = 'published'")
    .get() as { n: number; m: number };
  const key = `${stamp.n}:${stamp.m}`;
  if (bm25Cache?.key === key) return bm25Cache.index;

  const docs = await sqlite
    .prepare("select id, title, body from entries where status = 'published'")
    .all() as Array<{ id: string; title: string; body: string }>;
  bm25Cache = { key, index: new Bm25Index(docs) };
  return bm25Cache.index;
}

/**
 * Relevance search ranks with BM25 (natural-language queries work: stop words
 * are dropped and each remaining term adds to the score). The PostgreSQL
 * prefix query is the fallback for partial words such as "enrol".
 */
export async function searchEntries(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const sort = options.sort ?? "relevance";
  if (sort === "relevance") {
    const hits = (await getSearchIndex()).search(query, 200);
    if (hits.length > 0) return await rankedEntries(hits, options);
  }
  const match = toTsQuery(query);
  return match ? await runSearch(match, options) : [];
}

async function rankedEntries(hits: Array<{ id: string; score: number }>, options: SearchOptions): Promise<SearchResult[]> {
  const where = [`e.id in (${hits.map(() => "?").join(", ")})`, "e.status = 'published'"];
  const params: unknown[] = hits.map((hit) => hit.id);
  if (options.categoryId) {
    where.push("e.category_id = ?");
    params.push(options.categoryId);
  }
  if (options.from !== undefined) {
    where.push("e.created_at >= ?");
    params.push(options.from);
  }
  if (options.to !== undefined) {
    where.push("e.created_at <= ?");
    params.push(options.to);
  }

  const rows = await sqlite
    .prepare(`${ENTRY_SELECT} where ${where.join(" and ")}`)
    .all(...params) as EntryRecord[];
  const byId = new Map(rows.map((row) => [row.id, row]));

  return hits
    .filter((hit) => byId.has(hit.id))
    .slice(0, 50)
    .map((hit) => ({ ...byId.get(hit.id)!, rank: -hit.score }));
}

/** Zero-result help: a corrected spelling and loosely related published titles. */
export type SearchHelp = {
  suggestion: string | null;
  related: Array<{ id: string; title: string; category_slug: string; category_label: string }>;
};

export async function searchHelp(query: string): Promise<SearchHelp> {
  const rows = await sqlite
    .prepare(
      `select title, substr(body, 1, 400) as body from entries
       where status = 'published' order by created_at desc limit 1000`,
    )
    .all() as Array<{ title: string; body: string }>;
  const suggestion = didYouMean(
    query,
    vocabularyOf(rows.flatMap((row) => [row.title, row.body])),
  );

  const related = new Map<string, SearchHelp["related"][number]>();
  for (const attempt of [toTsQuery(query, "any"), suggestion ? toTsQuery(suggestion, "any") : null]) {
    if (!attempt) continue;
    for (const hit of (await runSearch(attempt, {})).slice(0, 5)) {
      related.set(hit.id, {
        id: hit.id,
        title: hit.title,
        category_slug: hit.category_slug,
        category_label: hit.category_label,
      });
    }
  }

  return { suggestion, related: [...related.values()].slice(0, 5) };
}

async function runSearch(match: string, options: SearchOptions): Promise<SearchResult[]> {
  const where = ["e.search_tsv @@ to_tsquery('english', ?)", "e.status = 'published'"];
  const params: unknown[] = [match];
  if (options.categoryId) {
    where.push("e.category_id = ?");
    params.push(options.categoryId);
  }
  if (options.from !== undefined) {
    where.push("e.created_at >= ?");
    params.push(options.from);
  }
  if (options.to !== undefined) {
    where.push("e.created_at <= ?");
    params.push(options.to);
  }

  const order = SEARCH_ORDER[options.sort ?? "relevance"] ?? SEARCH_ORDER.relevance;
  params.push(match); // rank expression in the SELECT list

  return await sqlite
    .prepare(
      `select e.id, e.title, e.body, e.status, e.is_anonymous, e.created_at, e.updated_at,
              e.reject_reason, e.category_id, c.label as category_label, c.slug as category_slug,
                   e.author_id, u.display_name as author_name, u.username as author_username,
              case when u.is_anonymous = 0 and u.avatar_path is not null then 1 else 0 end
                as author_has_avatar,
              (select count(*) from comments cm where cm.entry_id = e.id) as comment_count,
              (select count(*) from likes l where l.entry_id = e.id) as like_count,
              (select count(*) from reposts rp where rp.entry_id = e.id) as repost_count,
              ts_rank(e.search_tsv, to_tsquery('english', ?)) as rank
       from entries e
       join categories c on c.id = e.category_id
            join users u on u.id = e.author_id
       where ${where.join(" and ")}
       order by ${order}
       limit 50`,
    )
    .all(...params) as SearchResult[];
}

export type TrendingRecord = {
  id: string;
  title: string;
  category_slug: string;
  category_label: string;
  created_at: number;
  like_count: number;
  comment_count: number;
  repost_count: number;
  score: number;
};

/**
 * Local "trending" ranking: reactions and replies within the recent window.
 * Likes weigh more than a silent repost, and every result stays a published
 * post so the support panel never links to a queue item.
 */
export async function listTrendingEntries(days = 7, limit = 5): Promise<TrendingRecord[]> {
  const since = Date.now() - days * 86400_000;
  return await sqlite
    .prepare(
      `select e.id, e.title, c.slug as category_slug, c.label as category_label, e.created_at,
              (select count(*) from likes l where l.entry_id = e.id) as like_count,
              (select count(*) from comments cm where cm.entry_id = e.id) as comment_count,
              (select count(*) from reposts rp where rp.entry_id = e.id) as repost_count,
              (select count(*) from likes l where l.entry_id = e.id) * 3 +
              (select count(*) from comments cm where cm.entry_id = e.id) * 2 +
              (select count(*) from reposts rp where rp.entry_id = e.id) * 2 as score
       from entries e join categories c on c.id = e.category_id
       where e.status = 'published' and e.created_at >= ?
       order by score desc, e.created_at desc
       limit ?`,
    )
    .all(since, limit) as TrendingRecord[];
}

export type CommentRecord = {
  id: string;
  body: string;
  is_anonymous: number;
  created_at: number;
  parent_id: string | null;
  edited_at: number | null;
  author_id: string;
  author_name: string;
  author_username: string;
  author_has_avatar: number;
  like_count: number;
  viewer_has_liked?: boolean;
};

export async function listComments(entryId: string, viewerId?: string | null): Promise<CommentRecord[]> {
  const comments = await sqlite
    .prepare(
      `select cm.id, cm.body, cm.is_anonymous, cm.created_at, cm.parent_id, cm.edited_at, cm.author_id,
              u.display_name as author_name, u.username as author_username,
              case when u.is_anonymous = 0 and u.avatar_path is not null then 1 else 0 end
                as author_has_avatar,
              (select count(*) from comment_likes cl where cl.comment_id = cm.id) as like_count
       from comments cm join users u on u.id = cm.author_id
       where cm.entry_id = ? order by cm.created_at asc`,
    )
    .all(entryId) as CommentRecord[];

  if (!viewerId || comments.length === 0) return comments;

  const ids = comments.map((comment) => comment.id);
  const placeholders = ids.map(() => "?").join(", ");
  const liked = new Set(
    (
      await sqlite
        .prepare(
          `select comment_id from comment_likes where user_id = ? and comment_id in (${placeholders})`,
        )
        .all(viewerId, ...ids) as Array<{ comment_id: string }>
    ).map((row) => row.comment_id),
  );

  for (const comment of comments) {
    comment.viewer_has_liked = liked.has(comment.id);
  }

  return comments;
}

export type MentionTarget = { id: string; username: string; display_name: string };

/**
 * Maps lower-cased nicknames and usernames found after "@" to real accounts.
 * Pseudonymous rows are skipped. Duplicate nicknames resolve to the oldest
 * account, with an exact username match always winning.
 */
export async function resolveMentions(bodies: string[]): Promise<Map<string, MentionTarget>> {
  const keys = mentionKeys(bodies);
  const resolved = new Map<string, MentionTarget>();
  if (keys.length === 0) return resolved;

  const rows = await sqlite
    .prepare(
      `select id, username, display_name from users
       where is_anonymous = 0
         and (lower(username) in (${keys.map(() => "?").join(", ")})
           or lower(display_name) in (${keys.map(() => "?").join(", ")}))
       order by created_at desc`,
    )
    .all(...keys, ...keys) as MentionTarget[];

  // Oldest first wins for nicknames; usernames override below.
  for (const row of rows) resolved.set(row.display_name.toLowerCase(), row);
  for (const row of rows) resolved.set(row.username.toLowerCase(), row);
  return resolved;
}

export async function listAttachments(entryId: string): Promise<AttachmentFile[]> {
  return await sqlite
    .prepare(
      `select id, filename, mime_type, byte_size from attachments where entry_id = ? order by created_at asc`,
    )
    .all(entryId) as AttachmentFile[];
}

/**
 * Loads attachments for a page of posts in one query, so feed cards can show
 * their picture without a per-post round trip.
 */
export async function attachAttachments(entries: EntryRecord[]): Promise<EntryRecord[]> {
  if (entries.length === 0) return entries;

  const ids = entries.map((entry) => entry.id);
  const placeholders = ids.map(() => "?").join(", ");
  const rows = await sqlite
    .prepare(
      `select entry_id, id, filename, mime_type, byte_size
       from attachments where entry_id in (${placeholders}) order by created_at asc`,
    )
    .all(...ids) as Array<AttachmentFile & { entry_id: string }>;

  const byEntry = new Map<string, AttachmentFile[]>();
  for (const row of rows) {
    const list = byEntry.get(row.entry_id) ?? [];
    list.push({
      id: row.id,
      filename: row.filename,
      mime_type: row.mime_type,
      byte_size: row.byte_size,
    });
    byEntry.set(row.entry_id, list);
  }

  for (const entry of entries) {
    entry.media = byEntry.get(entry.id) ?? [];
  }

  return entries;
}

export async function countComments(entryId: string): Promise<number> {
  const row = await sqlite
    .prepare("select count(*) as n from comments where entry_id = ?")
    .get(entryId) as { n: number };
  return row.n;
}

export type ModerationRecord = {
  id: string;
  from_status: string;
  to_status: string;
  reason: string | null;
  created_at: number;
  actor_name: string;
};

export async function listModerationLog(entryId: string): Promise<ModerationRecord[]> {
  return await sqlite
    .prepare(
      `select m.id, m.from_status, m.to_status, m.reason, m.created_at, u.display_name as actor_name
       from moderation_log m join users u on u.id = m.actor_id
       where m.entry_id = ? order by m.created_at asc`,
    )
    .all(entryId) as ModerationRecord[];
}

/** Every pending entry, visible only to the USC administrator. */
export async function listQueue(): Promise<EntryRecord[]> {
  return await sqlite
    .prepare(`${ENTRY_SELECT} where e.status = 'pending' order by e.created_at asc`)
    .all() as EntryRecord[];
}

export async function listByAuthor(authorId: string, limit = 20): Promise<EntryRecord[]> {
  return await sqlite
    .prepare(
      `${ENTRY_SELECT} where e.author_id = ? and e.is_anonymous = 0
       order by e.created_at desc limit ?`,
    )
    .all(authorId, limit) as EntryRecord[];
}

export async function listPublishedByAuthor(
  authorId: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<Page<EntryRecord>> {
  return await pageEntries({
    where: ["e.author_id = ?", "e.is_anonymous = 0", "e.status = 'published'"],
    params: [authorId],
    ...options,
  });
}

export async function listRepostedEntries(
  userId: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<Page<EntryRecord>> {
  return await pageEntries({
    joins: "join reposts rp on rp.entry_id = e.id",
    where: ["rp.user_id = ?", "e.status = 'published'"],
    params: [userId],
    tsColumn: "rp.created_at",
    ...options,
  });
}

export type ProfileRecord = {
  id: string;
  username: string;
  role: string;
  display_name: string;
  has_avatar: number;
  created_at: number;
  post_count: number;
  repost_count: number;
  like_count: number;
};

/**
 * Public account lookup. Pseudonymous author rows are excluded so an
 * anonymous post can never be traced back to a profile.
 */
export async function getUserByUsername(username: string): Promise<ProfileRecord | undefined> {
  return await sqlite
    .prepare(
      `select u.id, u.username, u.role, u.display_name,
              case when u.avatar_path is not null then 1 else 0 end as has_avatar,
              
              u.created_at,
              (select count(*) from entries e where e.author_id = u.id and e.status = 'published')
                as post_count,
              (select count(*) from reposts r where r.user_id = u.id) as repost_count,
              (select count(*) from likes l join entries e on e.id = l.entry_id
                 where e.author_id = u.id and e.status = 'published') as like_count
       from users u
       where u.username = ? and u.is_anonymous = 0`,
    )
    .get(username) as ProfileRecord | undefined;
}

export type AccountRecord = {
  id: string;
  username: string;
  role: string;
  display_name: string;
  avatar_path: string | null;
  avatar_mime: string | null;
  created_at: number;
};

/** Loads the signed-in account, including its editable profile fields. */
export async function getAccountById(id: string): Promise<AccountRecord | undefined> {
  return await sqlite
    .prepare(
      `select u.id, u.username, u.role, u.display_name, u.avatar_path, u.avatar_mime,
               u.created_at
       from users u
       where u.id = ? and u.is_anonymous = 0`,
    )
    .get(id) as AccountRecord | undefined;
}

/** Adds media plus per-viewer like/save/repost flags to a page of entries. */
export async function attachViewerState(
  entries: EntryRecord[],
  viewerId?: string | null,
): Promise<EntryRecord[]> {
  if (entries.length === 0) return entries;

  await attachAttachments(entries);
  if (!viewerId) return entries;

  const ids = entries.map((entry) => entry.id);
  const placeholders = ids.map(() => "?").join(", ");

  const liked = new Set(
    (
      await sqlite
        .prepare(
          `select entry_id from likes where user_id = ? and entry_id in (${placeholders})`,
        )
        .all(viewerId, ...ids) as Array<{ entry_id: string }>
    ).map((row) => row.entry_id),
  );

  const saved = new Set(
    (
      await sqlite
        .prepare(
          `select entry_id from saves where user_id = ? and entry_id in (${placeholders})`,
        )
        .all(viewerId, ...ids) as Array<{ entry_id: string }>
    ).map((row) => row.entry_id),
  );

  const reposted = new Set(
    (
      await sqlite
        .prepare(
          `select entry_id from reposts where user_id = ? and entry_id in (${placeholders})`,
        )
        .all(viewerId, ...ids) as Array<{ entry_id: string }>
    ).map((row) => row.entry_id),
  );

  for (const entry of entries) {
    entry.viewer_has_liked = liked.has(entry.id);
    entry.viewer_has_saved = saved.has(entry.id);
    entry.viewer_has_reposted = reposted.has(entry.id);
  }

  return entries;
}

export async function listSavedEntries(
  userId: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<Page<EntryRecord>> {
  return await pageEntries({
    joins: "join saves sv on sv.entry_id = e.id",
    where: ["sv.user_id = ?", "e.status = 'published'"],
    params: [userId],
    tsColumn: "sv.created_at",
    ...options,
  });
}

/** Every submitted post in any state (drafts stay private), newest first. */
export async function listAllEntries(options: {
  status?: string;
  category?: string;
  q?: string;
  limit?: number;
  cursor?: string | null;
} = {}): Promise<Page<EntryRecord>> {
  const where = ["e.status <> 'draft'"];
  const params: unknown[] = [];
  if (options.status) {
    where.push("e.status = ?");
    params.push(options.status);
  }
  if (options.category) {
    where.push("c.slug = ?");
    params.push(options.category);
  }
  const q = options.q?.trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    where.push(
      "(e.title like ? escape '\\' or e.body like ? escape '\\' or (u.is_anonymous = 0 and u.display_name like ? escape '\\'))",
    );
    params.push(like, like, like);
  }
  return await pageEntries({ where, params, limit: options.limit ?? 30, cursor: options.cursor });
}

export async function listEntriesForModeration(): Promise<EntryRecord[]> {
  return await sqlite
    .prepare(
      `${ENTRY_SELECT} where e.status in ('pending','published','rejected','redacted')
       order by case e.status when 'pending' then 0 else 1 end, e.updated_at desc limit 100`,
    )
    .all() as EntryRecord[];
}

export type EventRecord = {
  id: string;
  title: string;
  description: string;
  location: string;
  registration_url: string | null;
  starts_at: number;
  created_at: number;
  organizer_id: string | null;
  rsvp_count: number;
};

const EVENT_SELECT = `
  select ev.id, ev.title, ev.description, ev.location, ev.registration_url, ev.starts_at,
         ev.created_at, ev.organizer_id,
         (select count(*) from rsvps r where r.event_id = ev.id) as rsvp_count
  from events ev
`;

export async function listEvents(includePast = false): Promise<EventRecord[]> {
  const cutoff = includePast ? 0 : Date.now() - 3_600_000;
  return await sqlite
    .prepare(`${EVENT_SELECT} where ev.starts_at >= ? order by ev.starts_at asc limit 60`)
    .all(cutoff) as EventRecord[];
}

export async function getEvent(id: string): Promise<EventRecord | undefined> {
  return await sqlite.prepare(`${EVENT_SELECT} where ev.id = ?`).get(id) as EventRecord | undefined;
}

export async function hasRsvp(eventId: string, userId: string): Promise<boolean> {
  return Boolean(
    await sqlite.prepare("select 1 from rsvps where event_id = ? and user_id = ?").get(eventId, userId),
  );
}

/** Everything scheduled inside an explicit window, used by the month grid. */
export async function listEventsBetween(start: number, end: number): Promise<EventRecord[]> {
  return await sqlite
    .prepare(`${EVENT_SELECT} where ev.starts_at >= ? and ev.starts_at < ? order by ev.starts_at asc`)
    .all(start, end) as EventRecord[];
}

export type EventAttendee = {
  id: string;
  display_name: string;
  username: string;
  has_avatar: number;
};

/** Named attendees only; anonymous accounts never appear in a list. */
export async function listEventAttendees(eventId: string, limit = 12): Promise<EventAttendee[]> {
  return await sqlite
    .prepare(
      `select u.id, u.display_name, u.username,
              case when u.avatar_path is not null then 1 else 0 end as has_avatar
       from rsvps r join users u on u.id = r.user_id
       where r.event_id = ? and u.is_anonymous = 0
       order by r.created_at asc
       limit ?`,
    )
    .all(eventId, limit) as EventAttendee[];
}

export type AdminStats = {
  entries: number;
  published: number;
  pending: number;
  rejected: number;
  redacted: number;
  anonymous: number;
  users: number;
  students: number;
  events: number;
  reports: number;
  outbox: number;
  safetyFlags: number;
};

export async function adminStats(): Promise<AdminStats> {
  const one = async (q: string) => (await sqlite.prepare(q).get() as { n: number }).n;
  return {
    entries: await one("select count(*) as n from entries"),
    published: await one("select count(*) as n from entries where status = 'published'"),
    pending: await one("select count(*) as n from entries where status = 'pending'"),
    rejected: await one("select count(*) as n from entries where status = 'rejected'"),
    redacted: await one("select count(*) as n from entries where status = 'redacted'"),
    anonymous: await one("select count(*) as n from entries where is_anonymous = 1"),
    users: await one("select count(*) as n from users"),
    students: await one("select count(*) as n from users where role = 'student'"),
    events: await one("select count(*) as n from events"),
    reports: await one("select count(*) as n from reports where resolved_at is null"),
    outbox: await one("select count(*) as n from outbox where read_at is null and to_user_id is null"),
    safetyFlags: await one("select count(*) as n from safety_flags where status = 'open'"),
  };
}

export type AdminAttention = { pending: number; safety: number; outbox: number; total: number };

/** Counts of items waiting on an admin, used for badges. */
export async function adminAttention(): Promise<AdminAttention> {
  const one = async (q: string) => (await sqlite.prepare(q).get() as { n: number }).n;
  const pending = await one("select count(*) as n from entries where status = 'pending'");
  const safety = await one("select count(*) as n from safety_flags where status = 'open'");
  const outbox = await one("select count(*) as n from outbox where read_at is null and to_user_id is null");
  return { pending, safety, outbox, total: pending + safety + outbox };
}

export type Insights = {
  byCategory: Array<{ label: string; count: number; published: number }>;
  weekly: Array<{ label: string; count: number }>;
  status: Array<{ label: string; count: number }>;
  reactions: { likes: number; comments: number; reposts: number; saves: number };
  decisions: number;
  /** Average hours between submission and the first final decision. */
  avgDecisionHours: number | null;
  rsvps: number;
  topEvents: Array<{ title: string; rsvp_count: number }>;
};

/**
 * Small, dependency-free dataset for the admin insights page. Everything is
 * derived from the Supabase tables so the thesis evaluation can quote real
 * numbers from the seeded instance.
 */
export async function adminInsights(): Promise<Insights> {
  const byCategory = await sqlite
    .prepare(
      `select c.label as label, count(e.id) as count,
              sum(case when e.status = 'published' then 1 else 0 end) as published
       from categories c left join entries e on e.category_id = c.id
       group by c.id order by c.sort_order asc`,
    )
    .all() as Array<{ label: string; count: number; published: number }>;

  const statusRows = await sqlite
    .prepare("select status as label, count(*) as count from entries group by status")
    .all() as Array<{ label: string; count: number }>;
  const statusOrder = ["draft", "pending", "published", "rejected", "redacted"];
  const status = statusOrder.map((label) => ({
    label,
    count: statusRows.find((row) => row.label === label)?.count ?? 0,
  }));

  // Eight weekly buckets ending with the current week.
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekly: Array<{ label: string; count: number }> = [];
  for (let i = 7; i >= 0; i -= 1) {
    const start = weekStart.getTime() - i * 7 * 86400_000;
    const end = start + 7 * 86400_000;
    const row = await sqlite
      .prepare("select count(*) as n from entries where created_at >= ? and created_at < ?")
      .get(start, end) as { n: number };
    weekly.push({
      label: new Date(start).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        timeZone: "Asia/Manila",
      }),
      count: row.n,
    });
  }

  const reactionRow = await sqlite
    .prepare(
      `select (select count(*) from likes) as likes,
              (select count(*) from comments) as comments,
              (select count(*) from reposts) as reposts,
              (select count(*) from saves) as saves`,
    )
    .get() as Insights["reactions"];

  const decisionRow = await sqlite
    .prepare(
      `select count(*) as n, avg(l.created_at - e.created_at) as avg_ms
       from moderation_log l join entries e on e.id = l.entry_id
       where l.to_status in ('published', 'rejected', 'redacted')`,
    )
    .get() as { n: number; avg_ms: number | null };

  const rsvpRow = await sqlite.prepare("select count(*) as n from rsvps").get() as { n: number };

  const topEvents = await sqlite
    .prepare(
      `select e.title, count(r.id) as rsvp_count
       from events e left join rsvps r on r.event_id = e.id
       group by e.id order by rsvp_count desc, e.starts_at asc limit 5`,
    )
    .all() as Array<{ title: string; rsvp_count: number }>;

  return {
    byCategory,
    weekly,
    status,
    reactions: reactionRow,
    decisions: decisionRow.n,
    avgDecisionHours:
      decisionRow.avg_ms === null ? null : Math.round((decisionRow.avg_ms / 3_600_000) * 10) / 10,
    rsvps: rsvpRow.n,
    topEvents,
  };
}

export type OutboxRecord = {
  id: string;
  kind: string;
  to_role: string | null;
  subject: string;
  body: string;
  href: string | null;
  created_at: number;
  read_at: number | null;
};

/** Admin/global messages only; personal rows belong in /activity. */
export async function listOutbox(limit = 50): Promise<OutboxRecord[]> {
  return await sqlite
    .prepare(
      `select id, kind, to_role, subject, body, href, created_at, read_at
       from outbox where to_user_id is null order by created_at desc limit ?`,
    )
    .all(limit) as OutboxRecord[];
}

export type SafetyFlagRecord = {
  id: string;
  target_type: "entry" | "account" | "comment";
  target_id: string;
  target_label: string;
  author_id: string | null;
  severity: "low" | "medium" | "high";
  categories: string;
  matched_terms: string;
  excerpt: string;
  explanation: string | null;
  provider: string;
  status: "open" | "reviewed" | "dismissed";
  reviewed_by: string | null;
  reviewed_at: number | null;
  created_at: number;
  updated_at: number;
  entry_title: string | null;
  entry_status: string | null;
  category_slug: string | null;
  account_username: string | null;
  author_username: string | null;
  comment_entry_id: string | null;
  comment_entry_slug: string | null;
  comment_entry_title: string | null;
};

/** Findings for the admin content-safety console, newest/highest first. */
export async function listSafetyFlags(options?: {
  status?: "open" | "reviewed" | "dismissed" | "all";
  limit?: number;
}): Promise<SafetyFlagRecord[]> {
  const status = options?.status ?? "open";
  const limit = options?.limit ?? 100;
  const where = status === "all" ? "" : "where f.status = ?";
  const params = status === "all" ? [limit] : [status, limit];

  return await sqlite
    .prepare(
      `select f.id, f.target_type, f.target_id, f.target_label, f.author_id, f.severity,
              f.categories, f.matched_terms, f.excerpt, f.explanation, f.provider, f.status,
              f.reviewed_by, f.reviewed_at, f.created_at, f.updated_at,
              e.title as entry_title, e.status as entry_status, c.slug as category_slug,
              u.username as account_username, a.username as author_username,
              cm.entry_id as comment_entry_id, cc.slug as comment_entry_slug,
              ce.title as comment_entry_title
       from safety_flags f
       left join entries e on f.target_type = 'entry' and e.id = f.target_id
       left join categories c on c.id = e.category_id
       left join users u on f.target_type = 'account' and u.id = f.target_id
       left join users a on a.id = f.author_id
       left join comments cm on f.target_type = 'comment' and cm.id = f.target_id
       left join entries ce on ce.id = cm.entry_id
       left join categories cc on cc.id = ce.category_id
       ${where}
       order by case f.severity when 'high' then 0 when 'medium' then 1 else 2 end,
                f.updated_at desc
       limit ?`,
    )
    .all(...params) as SafetyFlagRecord[];
}

export type SafetyStats = {
  open: number;
  high: number;
  medium: number;
  low: number;
  reviewed: number;
  dismissed: number;
};

export async function getSafetyStats(): Promise<SafetyStats> {
  const row = await sqlite
    .prepare(
      `select
         sum(case when status = 'open' then 1 else 0 end) as open,
         sum(case when status = 'open' and severity = 'high' then 1 else 0 end) as high,
         sum(case when status = 'open' and severity = 'medium' then 1 else 0 end) as medium,
         sum(case when status = 'open' and severity = 'low' then 1 else 0 end) as low,
         sum(case when status = 'reviewed' then 1 else 0 end) as reviewed,
         sum(case when status = 'dismissed' then 1 else 0 end) as dismissed
       from safety_flags`,
    )
    .get() as Record<keyof SafetyStats, number | null>;

  return {
    open: row.open ?? 0,
    high: row.high ?? 0,
    medium: row.medium ?? 0,
    low: row.low ?? 0,
    reviewed: row.reviewed ?? 0,
    dismissed: row.dismissed ?? 0,
  };
}

export type SafetyScanRecord = {
  id: string;
  scanned_count: number;
  flagged_count: number;
  notified_count: number;
  provider: string;
  created_at: number;
};

export async function getLastSafetyScan(): Promise<SafetyScanRecord | undefined> {
  return await sqlite
    .prepare(
      `select id, scanned_count, flagged_count, notified_count, provider, created_at
       from safety_scans order by created_at desc limit 1`,
    )
    .get() as SafetyScanRecord | undefined;
}

export type NotificationRecord = {
  id: string;
  kind: string;
  subject: string;
  body: string;
  href: string | null;
  created_at: number;
  read_at: number | null;
};

/** Personal notifications addressed to a signed-in user. */
export async function listNotifications(userId: string, limit = 50): Promise<NotificationRecord[]> {
  return await sqlite
    .prepare(
      `select id, kind, subject, body, href, created_at, read_at
       from outbox
       where to_user_id = ?
       order by created_at desc limit ?`,
    )
    .all(userId, limit) as NotificationRecord[];
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const row = await sqlite
    .prepare("select count(*) as n from outbox where to_user_id = ? and read_at is null")
    .get(userId) as { n: number };
  return row.n;
}

type ActivityAggregateRow = {
  entry_id: string;
  entry_title: string;
  entry_status: EntryStatus;
  category_slug: string;
  count: number;
  created_at: number;
  latest_actor: string | null;
  latest_body?: string | null;
};

type ModerationActivityRow = {
  activity_id: string;
  entry_id: string;
  entry_title: string;
  entry_status: EntryStatus;
  category_slug: string;
  to_status: string;
  reason: string | null;
  created_at: number;
};

/**
 * Builds the recipient-facing activity feed for a user's own posts. Social
 * actions are aggregated per post, while moderation transitions remain
 * separate events so the post's review history stays visible.
 */
export async function listActivity(userId: string, limit = 60): Promise<ActivityRecord[]> {
  const likes = await sqlite
    .prepare(
      `select e.id as entry_id, e.title as entry_title, e.status as entry_status,
              c.slug as category_slug, count(l.id) as count, max(l.created_at) as created_at,
              (select u2.display_name from likes l2 join users u2 on u2.id = l2.user_id
               where l2.entry_id = e.id and l2.user_id <> e.author_id
               order by l2.created_at desc limit 1) as latest_actor
       from entries e
       join categories c on c.id = e.category_id
       join likes l on l.entry_id = e.id
       where e.author_id = ? and e.is_anonymous = 0 and l.user_id <> e.author_id
       group by e.id, c.slug
       order by created_at desc
       limit ?`,
    )
    .all(userId, limit) as ActivityAggregateRow[];

  const reposts = await sqlite
    .prepare(
      `select e.id as entry_id, e.title as entry_title, e.status as entry_status,
              c.slug as category_slug, count(rp.id) as count, max(rp.created_at) as created_at,
              (select u2.display_name from reposts r2 join users u2 on u2.id = r2.user_id
               where r2.entry_id = e.id and r2.user_id <> e.author_id
               order by r2.created_at desc limit 1) as latest_actor
       from entries e
       join categories c on c.id = e.category_id
       join reposts rp on rp.entry_id = e.id
       where e.author_id = ? and e.is_anonymous = 0 and rp.user_id <> e.author_id
       group by e.id, c.slug
       order by created_at desc
       limit ?`,
    )
    .all(userId, limit) as ActivityAggregateRow[];

  const comments = await sqlite
    .prepare(
      `select e.id as entry_id, e.title as entry_title, e.status as entry_status,
              c.slug as category_slug, count(cm.id) as count, max(cm.created_at) as created_at,
              (select u2.display_name from comments cm2 join users u2 on u2.id = cm2.author_id
               where cm2.entry_id = e.id and cm2.author_id <> e.author_id
               order by cm2.created_at desc limit 1) as latest_actor,
              (select cm2.body from comments cm2
               where cm2.entry_id = e.id and cm2.author_id <> e.author_id
               order by cm2.created_at desc limit 1) as latest_body
       from entries e
       join categories c on c.id = e.category_id
       join comments cm on cm.entry_id = e.id
       where e.author_id = ? and e.is_anonymous = 0 and cm.author_id <> e.author_id
       group by e.id, c.slug
       order by created_at desc
       limit ?`,
    )
    .all(userId, limit) as ActivityAggregateRow[];

  const moderation = await sqlite
    .prepare(
      `select m.id as activity_id, m.entry_id, e.title as entry_title,
              e.status as entry_status, c.slug as category_slug,
              m.to_status, m.reason, m.created_at
       from moderation_log m
       join entries e on e.id = m.entry_id
       join categories c on c.id = e.category_id
       where e.author_id = ? and e.is_anonymous = 0 and m.from_status <> m.to_status
       order by m.created_at desc
       limit ?`,
    )
    .all(userId, limit) as ModerationActivityRow[];

  const records: ActivityRecord[] = [];

  for (const row of likes) {
    records.push({
      id: `like:${row.entry_id}`,
      kind: "like",
      entry_id: row.entry_id,
      entry_title: row.entry_title,
      entry_status: row.entry_status,
      category_slug: row.category_slug,
      created_at: row.created_at,
      count: row.count,
      latest_actor: row.latest_actor,
      detail: null,
      status: null,
      reason: null,
    });
  }

  for (const row of reposts) {
    records.push({
      id: `repost:${row.entry_id}`,
      kind: "repost",
      entry_id: row.entry_id,
      entry_title: row.entry_title,
      entry_status: row.entry_status,
      category_slug: row.category_slug,
      created_at: row.created_at,
      count: row.count,
      latest_actor: row.latest_actor,
      detail: null,
      status: null,
      reason: null,
    });
  }

  for (const row of comments) {
    records.push({
      id: `comment:${row.entry_id}`,
      kind: "comment",
      entry_id: row.entry_id,
      entry_title: row.entry_title,
      entry_status: row.entry_status,
      category_slug: row.category_slug,
      created_at: row.created_at,
      count: row.count,
      latest_actor: row.latest_actor,
      detail: row.latest_body ?? null,
      status: null,
      reason: null,
    });
  }

  for (const row of moderation) {
    records.push({
      id: `moderation:${row.activity_id}`,
      kind: "moderation",
      entry_id: row.entry_id,
      entry_title: row.entry_title,
      entry_status: row.entry_status,
      category_slug: row.category_slug,
      created_at: row.created_at,
      count: 1,
      latest_actor: null,
      detail: null,
      status: row.to_status,
      reason: row.reason,
    });
  }

  return records.sort((a, b) => b.created_at - a.created_at).slice(0, limit);
}

type OutgoingActivityRow = {
  activity_id: string;
  entry_id: string | null;
  entry_title: string | null;
  entry_status: EntryStatus | null;
  category_slug: string | null;
  actor: string | null;
  detail: string | null;
  created_at: number;
  parent_id?: string | null;
};

function postHref(row: OutgoingActivityRow): string | null {
  return row.entry_status === "published" && row.category_slug && row.entry_id
    ? `/c/${row.category_slug}/${row.entry_id}`
    : null;
}

/**
 * Everything the signed-in account did: posts, likes, comment likes,
 * comments and replies, reposts, saves, and event reservations. This is the
 * outgoing half of the merged Activity timeline.
 */
export async function listOutgoingActivity(
  userId: string,
  limit = 60,
): Promise<OutgoingActivityRecord[]> {
  const likes = await sqlite
    .prepare(
      `select l.id as activity_id, e.id as entry_id, e.title as entry_title,
              e.status as entry_status, c.slug as category_slug,
              u.display_name as actor, null as detail, l.created_at
       from likes l
       join entries e on e.id = l.entry_id
       join categories c on c.id = e.category_id
       join users u on u.id = e.author_id
       where l.user_id = ?
       order by l.created_at desc limit ?`,
    )
    .all(userId, limit) as OutgoingActivityRow[];

  const reposts = await sqlite
    .prepare(
      `select rp.id as activity_id, e.id as entry_id, e.title as entry_title,
              e.status as entry_status, c.slug as category_slug,
              u.display_name as actor, null as detail, rp.created_at
       from reposts rp
       join entries e on e.id = rp.entry_id
       join categories c on c.id = e.category_id
       join users u on u.id = e.author_id
       where rp.user_id = ?
       order by rp.created_at desc limit ?`,
    )
    .all(userId, limit) as OutgoingActivityRow[];

  const comments = await sqlite
    .prepare(
      `select cm.id as activity_id, e.id as entry_id, e.title as entry_title,
              e.status as entry_status, c.slug as category_slug,
              u.display_name as actor, cm.body as detail, cm.created_at, cm.parent_id
       from comments cm
       join entries e on e.id = cm.entry_id
       join categories c on c.id = e.category_id
       join users u on u.id = e.author_id
       where cm.author_id = ?
       order by cm.created_at desc limit ?`,
    )
    .all(userId, limit) as OutgoingActivityRow[];

  const commentLikes = await sqlite
    .prepare(
      `select cl.id as activity_id, e.id as entry_id, e.title as entry_title,
              e.status as entry_status, c.slug as category_slug,
              u.display_name as actor, cm.body as detail, cl.created_at
       from comment_likes cl
       join comments cm on cm.id = cl.comment_id
       join entries e on e.id = cm.entry_id
       join categories c on c.id = e.category_id
       join users u on u.id = cm.author_id
       where cl.user_id = ?
       order by cl.created_at desc limit ?`,
    )
    .all(userId, limit) as OutgoingActivityRow[];

  const saves = await sqlite
    .prepare(
      `select s.id as activity_id, e.id as entry_id, e.title as entry_title,
              e.status as entry_status, c.slug as category_slug,
              u.display_name as actor, null as detail, s.created_at
       from saves s
       join entries e on e.id = s.entry_id
       join categories c on c.id = e.category_id
       join users u on u.id = e.author_id
       where s.user_id = ?
       order by s.created_at desc limit ?`,
    )
    .all(userId, limit) as OutgoingActivityRow[];

  const posts = await sqlite
    .prepare(
      `select e.id as activity_id, e.id as entry_id, e.title as entry_title,
              e.status as entry_status, c.slug as category_slug,
              null as actor, null as detail, e.created_at
       from entries e
       join categories c on c.id = e.category_id
       where e.author_id = ? and e.is_anonymous = 0
       order by e.created_at desc limit ?`,
    )
    .all(userId, limit) as OutgoingActivityRow[];

  const rsvps = await sqlite
    .prepare(
      `select r.id as activity_id, null as entry_id, ev.title as entry_title,
              null as entry_status, null as category_slug,
              null as actor, null as detail, r.created_at
       from rsvps r
       join events ev on ev.id = r.event_id
       where r.user_id = ?
       order by r.created_at desc limit ?`,
    )
    .all(userId, limit) as OutgoingActivityRow[];

  const records: OutgoingActivityRecord[] = [];

  const add = (
    row: OutgoingActivityRow,
    kind: OutgoingActivityRecord["kind"],
    extra: Partial<Pick<OutgoingActivityRecord, "href" | "is_reply">> = {},
  ) => {
    records.push({
      id: `${kind}:${row.activity_id}`,
      kind,
      entry_id: row.entry_id,
      entry_title: row.entry_title,
      entry_status: row.entry_status,
      category_slug: row.category_slug,
      created_at: row.created_at,
      actor: row.actor,
      detail: row.detail,
      href: extra.href ?? postHref(row),
      is_reply: extra.is_reply,
    });
  };

  likes.forEach((row) => add(row, "like"));
  reposts.forEach((row) => add(row, "repost"));
  comments.forEach((row) =>
    add(row, "comment", { is_reply: Boolean(row.parent_id) }),
  );
  commentLikes.forEach((row) => add(row, "comment-like"));
  saves.forEach((row) => add(row, "save"));
  posts.forEach((row) => add(row, "post"));
  rsvps.forEach((row) => add(row, "rsvp", { href: "/events" }));

  return records.sort((a, b) => b.created_at - a.created_at).slice(0, limit);
}

export type UserRecord = {
  id: string;
  username: string;
  role: string;
  display_name: string;
  created_at: number;
  entry_count: number;
};

export async function listUsers(limit = 100): Promise<UserRecord[]> {
  return await sqlite
    .prepare(
      `select u.id, u.username, u.role, u.display_name,  u.created_at,
              (select count(*) from entries e where e.author_id = u.id) as entry_count
       from users u
       order by case u.role when 'admin' then 0 else 1 end, u.created_at desc
       limit ?`,
    )
    .all(limit) as UserRecord[];
}

export async function listReports(limit = 30) {
  return await sqlite
    .prepare(
      `select r.id, r.reason, r.created_at, r.resolved_at, e.title as entry_title, e.id as entry_id, c.slug as category_slug,
              u.display_name as reporter_name
       from reports r join entries e on e.id = r.entry_id join categories c on c.id = e.category_id join users u on u.id = r.reporter_id
       order by r.created_at desc limit ?`,
    )
    .all(limit) as {
    id: string;
    reason: string;
    created_at: number;
    resolved_at: number | null;
    entry_title: string;
    entry_id: string;
    category_slug: string;
    reporter_name: string;
  }[];
}

export async function listEntryReports(entryId: string) {
  return await sqlite
    .prepare(
      `select r.id, r.reason, r.created_at, r.resolved_at, u.display_name as reporter_name
       from reports r join users u on u.id = r.reporter_id
       where r.entry_id = ? order by r.created_at desc`,
    )
    .all(entryId) as {
    id: string;
    reason: string;
    created_at: number;
    resolved_at: number | null;
    reporter_name: string;
  }[];
}

export async function countSavedEntries(userId: string): Promise<number> {
  const row = await sqlite
    .prepare(
      `select count(*) as n from saves sv join entries e on e.id = sv.entry_id
       where sv.user_id = ? and e.status = 'published'`,
    )
    .get(userId) as { n: number };
  return row.n;
}
