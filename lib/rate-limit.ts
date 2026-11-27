import { sqlite } from "./db/client";

/**
 * Fixed-window rate limiting, keyed by session rather than by IP so that
 * anonymous posting never requires retaining network identifiers.
 */
export async function hitLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const row = await sqlite
    .prepare("select window_start, count from rate_limits where key = ?")
    .get(key) as { window_start: number; count: number } | undefined;

  if (!row || now - row.window_start > windowMs) {
    await sqlite
      .prepare(
        `insert into rate_limits (key, window_start, count) values (?, ?, 1)
         on conflict (key) do update set window_start = excluded.window_start, count = 1`,
      )
      .run(key, now);
    return true;
  }

  if (row.count >= limit) return false;

  await sqlite.prepare("update rate_limits set count = count + 1 where key = ?").run(key);
  return true;
}
