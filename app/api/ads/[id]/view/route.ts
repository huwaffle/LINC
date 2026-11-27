import { NextResponse } from "next/server";
import { getAd, recordImpression } from "@/lib/db/ads";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (await getAd(id)) await recordImpression(id);
  return new NextResponse(null, { status: 204 });
}
