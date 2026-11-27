/** One colour per category, used for the admin's colour-coded view of posts. */
export const CATEGORY_COLORS: Record<string, string> = {
  announcements: "#2563eb",
  concerns: "#dc2626",
  academic: "#7c3aed",
  events: "#ea580c",
  services: "#0d9488",
  policies: "#475569",
  suggestions: "#ca8a04",
  inquiries: "#0891b2",
  organizations: "#be185d",
  opportunities: "#16a34a",
  "study-hub": "#4f46e5",
  "freedom-wall": "#db2777",
  memes: "#d97706",
  "lost-found": "#65a30d",
  marketplace: "#c2410c",
  general: "#6b7280",
};

export function categoryColor(slug: string): string {
  return CATEGORY_COLORS[slug] ?? "#6b7280";
}

/** Inline styles that stay readable in both themes (text mixes toward the theme ink). */
export function categoryChipStyle(slug: string): React.CSSProperties {
  const color = categoryColor(slug);
  return {
    backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
    color: `color-mix(in srgb, ${color} 65%, var(--color-ink))`,
  };
}
