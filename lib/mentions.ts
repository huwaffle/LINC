/**
 * @nickname mentions. Nicknames can contain spaces and are not unique, so a
 * mention resolves by trying the longest run of words after "@" first
 * ("@Student 1001 thanks" -> "student 1001"), then shorter ones. A student
 * number (the account username) always works too.
 */

const MAX_WORDS = 4;
const TRAILING = /[.,!?;:)\]]+$/;

type Spot = { start: number; candidates: string[] };

function spots(body: string): Spot[] {
  const found: Spot[] = [];
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] !== "@" || (i > 0 && /[\p{L}\p{N}]/u.test(body[i - 1]))) continue;
    const words = (body.slice(i + 1).match(/^[^\n@]{0,80}/)?.[0] ?? "").split(" ");
    const candidates: string[] = [];
    for (let n = Math.min(MAX_WORDS, words.length); n >= 1; n -= 1) {
      const candidate = words.slice(0, n).join(" ").replace(TRAILING, "");
      if (candidate) candidates.push(candidate);
    }
    if (candidates.length) found.push({ start: i, candidates });
  }
  return found;
}

/** Lower-cased lookup keys worth resolving against the users table. */
export function mentionKeys(bodies: string[]): string[] {
  const keys = new Set<string>();
  for (const body of bodies) {
    for (const spot of spots(body)) for (const c of spot.candidates) keys.add(c.toLowerCase());
  }
  return [...keys];
}

export type MentionPart =
  | { type: "text"; text: string }
  | { type: "mention"; text: string; username: string };

export function splitMentions(
  body: string,
  resolved: ReadonlyMap<string, { username: string }>,
): MentionPart[] {
  const parts: MentionPart[] = [];
  let cursor = 0;

  for (const spot of spots(body)) {
    if (spot.start < cursor) continue;
    const hit = spot.candidates.find((c) => resolved.has(c.toLowerCase()));
    if (!hit) continue;

    if (spot.start > cursor) parts.push({ type: "text", text: body.slice(cursor, spot.start) });
    parts.push({
      type: "mention",
      text: `@${hit}`,
      username: resolved.get(hit.toLowerCase())!.username,
    });
    cursor = spot.start + 1 + hit.length;
  }

  if (cursor < body.length) parts.push({ type: "text", text: body.slice(cursor) });
  return parts.length ? parts : [{ type: "text", text: body }];
}
