import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/** Lets the error pages tell "the database is down" apart from a plain bug. */
export async function GET() {
  try {
    await sqlite.prepare("select 1").get();
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
