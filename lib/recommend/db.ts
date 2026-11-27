import { sqlite } from "../db/client";
import {
  ENTRY_SELECT,
  PAGE_SIZE,
  listEvents,
  type EntryRecord,
  type EventRecord,
  type Page,
  listCategories,
  type CategoryRecord,
} from "../db/queries";
import { buildProfile, rank, scoreCandidates, type InterestProfile, type Signal } from "./engine";

const SIGNAL_LIMIT = 400;
const POOL_SIZE = 300;

const ENTRY_SIGNALS = `
  select e.id, e.title, e.body, e.category_id, s.kind, s.ts, s.n
  from (
    select entry_id, 'like' as kind, created_at as ts, 1 as n from likes where user_id = ?
    union all select entry_id, 'save', created_at, 1 from saves where user_id = ?
    union all select entry_id, 'repost', created_at, 1 from reposts where user_id = ?
    union all select entry_id, 'comment', created_at, 1 from comments where author_id = ?
    union all select item_id, 'view', last_viewed_at, views from interest_views
      where user_id = ? and kind = 'entry'
  ) s
  join entries e on e.id = s.entry_id
  where e.status = 'published'
  order by s.ts desc limit ${SIGNAL_LIMIT}
`;

const EVENT_SIGNALS = `
  select ev.title, ev.description, s.kind, s.ts, s.n
  from (
    select event_id, 'rsvp' as kind, created_at as ts, 1 as n from rsvps where user_id = ?
    union all select item_id, 'view', last_viewed_at, views from interest_views
      where user_id = ? and kind = 'event'
  ) s
  join events ev on ev.id = s.event_id
  order by s.ts desc limit ${SIGNAL_LIMIT}
`;

/** Counts a post or event open; repeat opens raise the interest weight. */
export async function recordView(userId: string, kind: "entry" | "event", itemId: string): Promise<void> {
  await sqlite
    .prepare(
      `insert into interest_views (user_id, kind, item_id, views, last_viewed_at)
       values (?, ?, ?, 1, ?)
       on conflict (user_id, kind, item_id)
       do update set views = interest_views.views + 1, last_viewed_at = excluded.last_viewed_at`,
    )
    .run(userId, kind, itemId, Date.now());
}

export async function getInterestProfile(userId: string | null | undefined): Promise<InterestProfile | null> {
  if (!userId) return null;

  const signals: Signal[] = [];
  for (const r of await sqlite.prepare(ENTRY_SIGNALS).all(
    userId, userId, userId, userId, userId,
  ) as Array<{
    title: string; body: string; category_id: string;
    kind: Signal["kind"]; ts: number; n: number;
  }>) {
    signals.push({
      kind: r.kind, count: r.n, at: r.ts, categoryId: r.category_id,
      text: `${r.title} ${r.body}`,
    });
  }
  for (const r of await sqlite.prepare(EVENT_SIGNALS).all(userId, userId) as Array<{
    title: string; description: string;
    kind: Signal["kind"]; ts: number; n: number;
  }>) {
    signals.push({
      kind: r.kind, count: r.n, at: r.ts,
      text: `${r.title} ${r.description}`,
    });
  }

  const profile = buildProfile(signals);
  return profile.total > 0 ? profile : null;
}

async function viewedIds(userId: string, kind: "entry" | "event"): Promise<Set<string>> {
  return new Set(
    (
      await sqlite
        .prepare("select item_id from interest_views where user_id = ? and kind = ?")
        .all(userId, kind) as Array<{ item_id: string }>
    ).map((r) => r.item_id),
  );
}

function engagement(e: EntryRecord): number {
  return e.like_count * 3 + e.comment_count * 2 + e.repost_count * 2;
}

/**
 * "For you" feed. Returns null when the user has no history yet, so callers
 * fall back to the chronological feed. The cursor is an offset into the ranked pool.
 */
export async function listForYouEntries(
  userId: string | null | undefined,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<Page<EntryRecord> | null> {
  const profile = await getInterestProfile(userId);
  if (!userId || !profile) return null;

  const pool = await sqlite
    .prepare(`${ENTRY_SELECT} where e.status = 'published' order by e.created_at desc limit ?`)
    .all(POOL_SIZE) as EntryRecord[];
  const seen = await viewedIds(userId, "entry");

  const ranked = rank(
    pool.map((entry) => ({
      id: entry.id,
      categoryId: entry.category_id,
      text: `${entry.title} ${entry.body}`,
      createdAt: entry.created_at,
      engagement: engagement(entry),
      seen: seen.has(entry.id),
      entry,
    })),
    profile,
  );

  const limit = options.limit ?? PAGE_SIZE;
  const offset = Math.max(0, Number(options.cursor) || 0);
  const items = ranked.slice(offset, offset + limit).map((r) => r.item.entry);
  const next = offset + limit;
  return { items, nextCursor: next < ranked.length ? String(next) : null };
}

/** Upcoming events ordered by how well they match the viewer's interests. */
export async function listEventsForYou(userId: string | null | undefined, includePast = false): Promise<EventRecord[]> {
  const events = await listEvents(includePast);
  const profile = await getInterestProfile(userId);
  if (!userId || !profile || events.length < 2) return events;

  const seen = await viewedIds(userId, "event");
  const now = Date.now();
  const scored = scoreCandidates(
    events.map((event) => ({
      id: event.id,
      text: `${event.title} ${event.description}`,
      // Sooner events count as "fresher".
      createdAt: now - Math.max(0, event.starts_at - now),
      engagement: event.rsvp_count,
      seen: seen.has(event.id),
      event,
    })),
    profile,
    { categoryWeight: 0, freshnessDays: 7 },
  );
  return scored.sort((a, b) => b.score - a.score).map((s) => s.item.event);
}

export type Suggestions = {
  categories: CategoryRecord[];
};

/** Strongest categories in the viewer's profile. */
export async function getSuggestions(userId: string | null | undefined, limit = 3): Promise<Suggestions | null> {
  const profile = await getInterestProfile(userId);
  if (!profile) return null;

  const top = <T extends { id: string }>(items: T[], weights: Map<string, number>) =>
    items
      .filter((item) => (weights.get(item.id) ?? 0) > 0)
      .sort((a, b) => (weights.get(b.id) ?? 0) - (weights.get(a.id) ?? 0))
      .slice(0, limit);

  const categories = top(await listCategories(), profile.categories);
  return categories.length > 0 ? { categories } : null;
}
