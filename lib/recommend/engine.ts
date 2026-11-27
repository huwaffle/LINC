import { tokenize } from "../ml/text";

/** Interaction weights: deliberate actions say more about interest than passive views. */
export const SIGNAL_WEIGHTS = {
  view: 1,
  like: 3,
  repost: 3,
  save: 4,
  comment: 4,
  rsvp: 5,
} as const;

export type SignalKind = keyof typeof SIGNAL_WEIGHTS;

export type Signal = {
  kind: SignalKind;
  /** How many times it happened (only meaningful for views). */
  count?: number;
  at: number;
  categoryId?: string | null;
  text: string;
};

export type InterestProfile = {
  categories: Map<string, number>;
  terms: Map<string, number>;
  /** Sum of all signal weights; 0 means a cold start. */
  total: number;
};

export type Candidate = {
  id: string;
  categoryId?: string | null;
  text: string;
  createdAt: number;
  /** Raw engagement (likes, replies, reposts or RSVPs). */
  engagement: number;
  seen?: boolean;
};

export const SIGNAL_HALF_LIFE_DAYS = 14;
const DAY = 86_400_000;
const MAX_PROFILE_TERMS = 80;

export function decay(ageMs: number, halfLifeDays: number): number {
  return Math.pow(0.5, Math.max(0, ageMs) / (halfLifeDays * DAY));
}

function add(map: Map<string, number>, key: string, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

/** Folds interaction history into recency-weighted category and keyword affinities. */
export function buildProfile(signals: Signal[], now = Date.now()): InterestProfile {
  const profile: InterestProfile = {
    categories: new Map(),
    terms: new Map(),
    total: 0,
  };

  for (const signal of signals) {
    const repeat = signal.kind === "view" ? Math.min(Math.max(signal.count ?? 1, 1), 3) : 1;
    const weight = SIGNAL_WEIGHTS[signal.kind] * repeat * decay(now - signal.at, SIGNAL_HALF_LIFE_DAYS);
    if (weight <= 0) continue;

    profile.total += weight;
    if (signal.categoryId) add(profile.categories, signal.categoryId, weight);

    const terms = new Set(tokenize(signal.text));
    const share = weight / Math.sqrt(Math.max(terms.size, 1));
    for (const term of terms) add(profile.terms, term, share);
  }

  if (profile.terms.size > MAX_PROFILE_TERMS) {
    const top = [...profile.terms].sort((a, b) => b[1] - a[1]).slice(0, MAX_PROFILE_TERMS);
    profile.terms = new Map(top);
  }
  return profile;
}

/** Share of the strongest entry, so every affinity lands in 0..1. */
function normalised(map: Map<string, number>, key?: string | null): number {
  if (!key || map.size === 0) return 0;
  let max = 0;
  for (const value of map.values()) max = Math.max(max, value);
  return max > 0 ? (map.get(key) ?? 0) / max : 0;
}

export type Scored<T> = { item: T; score: number; reasons: string[] };

export type ScoreOptions = {
  now?: number;
  /** Half-life of the freshness bonus. */
  freshnessDays?: number;
  /** Weight for category affinity; events have no category so they pass 0. */
  categoryWeight?: number;
};

/**
 * Scores candidates against a profile:
 *   topic (category) match + keyword match (IDF-weighted over the pool)
 *   + freshness + popularity,
 * with seen items demoted.
 */
export function scoreCandidates<T extends Candidate>(
  items: T[],
  profile: InterestProfile,
  options: ScoreOptions = {},
): Array<Scored<T>> {
  const now = options.now ?? Date.now();
  const freshness = options.freshnessDays ?? 3;
  const categoryWeight = options.categoryWeight ?? 0.45;
  const termWeight = 0.3;

  const docs = items.map((item) => new Set(tokenize(item.text)));
  const df = new Map<string, number>();
  for (const doc of docs) for (const term of doc) df.set(term, (df.get(term) ?? 0) + 1);
  const idf = (term: string) => Math.log(1 + items.length / (df.get(term) ?? 1));

  const keyword = docs.map((doc) => {
    let sum = 0;
    for (const term of doc) {
      const w = profile.terms.get(term);
      if (w) sum += w * idf(term);
    }
    return sum / Math.sqrt(Math.max(doc.size, 1));
  });
  const maxKeyword = Math.max(0, ...keyword);
  const maxEngagement = Math.max(1, ...items.map((item) => item.engagement));

  return items.map((item, i) => {
    const topic = normalised(profile.categories, item.categoryId);
    const terms = maxKeyword > 0 ? keyword[i] / maxKeyword : 0;
    const fresh = decay(now - item.createdAt, freshness);
    const popular = Math.log1p(item.engagement) / Math.log1p(maxEngagement);

    let score =
      categoryWeight * topic + termWeight * terms + 0.15 * fresh + 0.1 * popular;
    if (item.seen) score *= 0.6;

    const reasons: string[] = [];
    if (topic >= 0.5) reasons.push("topic");
    if (terms >= 0.5) reasons.push("keywords");
    return { item, score, reasons };
  });
}

/**
 * Greedy re-rank that discounts each repeat of a category, so one hot topic
 * can't take over the whole feed (the "keep it fresh" part of a For You page).
 */
export function diversify<T extends Candidate>(
  scored: Array<Scored<T>>,
  penalty = 0.85,
): Array<Scored<T>> {
  const pool = [...scored];
  const picked: Array<Scored<T>> = [];
  const taken = new Map<string, number>();

  while (pool.length > 0) {
    let best = 0;
    let bestValue = -Infinity;
    for (let i = 0; i < pool.length; i += 1) {
      const key = pool[i].item.categoryId ?? "";
      const value =
        pool[i].score * Math.pow(penalty, taken.get(key) ?? 0) +
        // Stable tie-break toward the newer item.
        pool[i].item.createdAt * 1e-18;
      if (value > bestValue) {
        bestValue = value;
        best = i;
      }
    }
    const [next] = pool.splice(best, 1);
    picked.push(next);
    const key = next.item.categoryId ?? "";
    taken.set(key, (taken.get(key) ?? 0) + 1);
  }
  return picked;
}

export function rank<T extends Candidate>(
  items: T[],
  profile: InterestProfile,
  options?: ScoreOptions,
): Array<Scored<T>> {
  return diversify(scoreCandidates(items, profile, options));
}
