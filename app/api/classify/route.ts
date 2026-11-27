import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { sqlite } from "@/lib/db/client";
import { getClassifier, predictCategory } from "@/lib/ml/classifier";
import { hitLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Suggests a category for a draft submission (TF-IDF + linear SVM). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!await hitLimit(`classify:${session.id}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.slice(0, 5000) : "";
  if (text.trim().length < 10) return NextResponse.json({ suggestion: null });

  const prediction = predictCategory(getClassifier(), text);
  const rows = await sqlite.prepare("select id, slug, label from categories").all() as Array<{
    id: string;
    slug: string;
    label: string;
  }>;
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  const top = bySlug.get(prediction.label);
  if (!top) return NextResponse.json({ suggestion: null });

  return NextResponse.json(
    {
      suggestion: {
        categoryId: top.id,
        slug: top.slug,
        label: top.label,
        confidence: prediction.confidence,
        alternatives: prediction.scores
          .slice(1, 3)
          .map((s) => bySlug.get(s.label))
          .filter(Boolean)
          .map((row) => ({ categoryId: row!.id, label: row!.label })),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
