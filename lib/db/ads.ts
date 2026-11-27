import { sqlite } from "./client";

export type AdRecord = {
  id: string;
  title: string;
  body: string;
  sponsor: string;
  link_url: string;
  image_path: string | null;
  image_mime: string | null;
  active: number;
  created_at: number;
  impressions: number;
  clicks: number;
  starts_at: number | null;
  ends_at: number | null;
};

const COLUMNS =
  "id, title, body, sponsor, link_url, image_path, image_mime, active, created_at, impressions, clicks, starts_at, ends_at";

export async function listAds(): Promise<AdRecord[]> {
  return await sqlite.prepare(`select ${COLUMNS} from ads order by created_at desc`).all() as AdRecord[];
}

export async function getAd(id: string): Promise<AdRecord | undefined> {
  return await sqlite.prepare(`select ${COLUMNS} from ads where id = ?`).get(id) as AdRecord | undefined;
}

export type AdState = "active" | "paused" | "scheduled" | "ended";

export function adState(ad: AdRecord, now = Date.now()): AdState {
  if (!ad.active) return "paused";
  if (ad.starts_at !== null && ad.starts_at > now) return "scheduled";
  if (ad.ends_at !== null && ad.ends_at < now) return "ended";
  return "active";
}

/** A random ad that is switched on and inside its schedule window. */
export async function pickAd(): Promise<AdRecord | undefined> {
  const now = Date.now();
  return await sqlite
    .prepare(
      `select ${COLUMNS} from ads
       where active = 1
         and (starts_at is null or starts_at <= ?)
         and (ends_at is null or ends_at >= ?)
       order by random() limit 1`,
    )
    .get(now, now) as AdRecord | undefined;
}

/** Every ad currently inside its schedule window, newest first. */
export async function listActiveAds(limit = 6): Promise<AdRecord[]> {
  const now = Date.now();
  return await sqlite
    .prepare(
      `select ${COLUMNS} from ads
       where active = 1
         and (starts_at is null or starts_at <= ?)
         and (ends_at is null or ends_at >= ?)
       order by created_at desc limit ?`,
    )
    .all(now, now, limit) as AdRecord[];
}

export async function recordImpression(id: string): Promise<void> {
  await sqlite.prepare("update ads set impressions = impressions + 1 where id = ?").run(id);
}

export async function recordClick(id: string): Promise<void> {
  await sqlite.prepare("update ads set clicks = clicks + 1 where id = ?").run(id);
}

export function isSafeAdUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const DEMO_ADS = [
  {
    id: "adv-demo-1",
    sponsor: "Lasallian Bookstore",
    title: "Back-to-school bundle: 15% off notebooks and pens",
    body: "Show your student ID at the campus bookstore and save on all stationery this month.",
    link: "https://example.com/bookstore",
  },
  {
    id: "adv-demo-2",
    sponsor: "Brew & Byte Cafe",
    title: "Study-night iced coffee for just 75 pesos",
    body: "Open until midnight during exam week, with free Wi-Fi and plenty of outlets.",
    link: "https://example.com/brew-and-byte",
  },
  {
    id: "adv-demo-3",
    sponsor: "Araneta Career Fair",
    title: "Meet 40+ hiring companies at the Career Fair",
    body: "Bring printed resumes and register early to get a priority interview slot.",
    link: "https://example.com/career-fair",
  },
  {
    id: "adv-demo-4",
    sponsor: "Campus Print Hub",
    title: "Same-day thesis printing and binding",
    body: "Drop your files by 10 AM and pick up your copies before dinner.",
    link: "https://example.com/print-hub",
  },
];

/** Inserts the sample ads once; safe to run repeatedly. Returns how many were added. */
export async function seedDemoAds(): Promise<number> {
  const insert = sqlite.prepare(
    `insert into ads (id, title, body, sponsor, link_url, active, created_at, impressions, clicks)
     values (?, ?, ?, ?, ?, 1, ?, 0, 0)
     on conflict (id) do nothing`,
  );
  let added = 0;
  const now = Date.now();
  for (const [index, ad] of DEMO_ADS.entries()) {
    const result = await insert.run(ad.id, ad.title, ad.body, ad.sponsor, ad.link, now - index * 1000);
    added += result.changes;
  }
  return added;
}
