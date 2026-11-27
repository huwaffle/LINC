import { stem, tokenize } from "./ml/text";

export type Topic = { slug: string; label: string; description: string; keywords: string[] };

/** A topic becomes a category once this many published posts mention it. */
export const TOPIC_THRESHOLD = 3;

export const AUTO_PREFIX = "cat-auto-";

export const TOPICS: Topic[] = [
  {
    slug: "sports", label: "Sports",
    description: "Games, tryouts, intramurals, and competitions.",
    keywords: ["basketball", "volleyball", "football", "soccer", "badminton", "swimming", "tennis",
      "athlete", "tryout", "intramural", "tournament", "varsity", "chess", "esports", "futsal", "cheerdance"],
  },
  {
    slug: "programming", label: "Programming",
    description: "Coding, hackathons, developer tools, and tech talks.",
    keywords: ["programming", "coding", "python", "javascript", "java", "hackathon", "developer",
      "software", "github", "algorithm", "website", "cybersecurity", "robotics", "ai"],
  },
  {
    slug: "arts-culture", label: "Arts & Culture",
    description: "Music, theater, exhibits, and creative showcases.",
    keywords: ["music", "concert", "band", "theater", "theatre", "dance", "painting", "exhibit",
      "choir", "film", "photography", "art", "singing"],
  },
  {
    slug: "health-wellness", label: "Health & Wellness",
    description: "Mental health, fitness, clinic services, and wellbeing.",
    keywords: ["health", "wellness", "clinic", "counseling", "mental", "fitness", "vaccine",
      "blood", "nutrition", "yoga", "medical"],
  },
  {
    slug: "community-service", label: "Community Service",
    description: "Outreach, volunteering, and charity drives.",
    keywords: ["outreach", "volunteer", "charity", "donation", "fundraising", "lasallian", "livelihood", "feeding"],
  },
  {
    slug: "scholarships", label: "Scholarships",
    description: "Scholarships, grants, and financial assistance.",
    keywords: ["scholarship", "grant", "tuition", "allowance", "stipend", "financial"],
  },
];

export type TopicPost = { id: string; text: string };

/** Ids of posts that mention at least one keyword of the topic (stemmed, whole-word). */
export function matchTopic(topic: Topic, posts: TopicPost[]): string[] {
  const keys = new Set(topic.keywords.map(stem));
  return posts.filter((p) => tokenize(p.text).some((t) => keys.has(t))).map((p) => p.id);
}

/** Topics mentioned by enough posts, with the posts that mention them. */
export function detectTopics(
  posts: TopicPost[],
  threshold = TOPIC_THRESHOLD,
  topics: Topic[] = TOPICS,
): Array<{ topic: Topic; postIds: string[] }> {
  return topics
    .map((topic) => ({ topic, postIds: matchTopic(topic, posts) }))
    .filter((hit) => hit.postIds.length >= threshold);
}
