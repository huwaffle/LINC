import { NextResponse } from "next/server";
import { getAd, isSafeAdUrl, recordClick } from "@/lib/db/ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Counts the click, then forwards to the advertiser's link. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ad = await getAd(id);
  if (!ad || !isSafeAdUrl(ad.link_url)) return NextResponse.redirect(new URL("/", request.url));

  await recordClick(id);
  return NextResponse.redirect(ad.link_url, { status: 307 });
}
