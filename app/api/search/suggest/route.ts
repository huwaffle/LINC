import { NextResponse } from "next/server";
import { searchCategories, searchEntries } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/** Typeahead for the search box. Only published posts are indexed already. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ items: [], categories: [] });
  }

  const items = (await searchEntries(q))
    .slice(0, 6)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      categorySlug: entry.category_slug,
      categoryLabel: entry.category_label,
    }));

  const categories = (await searchCategories(q)).map((c) => ({ slug: c.slug, label: c.label, total: c.total }));

  return NextResponse.json({ items, categories }, { headers: { "Cache-Control": "no-store" } });
}
