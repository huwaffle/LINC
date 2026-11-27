import { NextResponse } from "next/server";
import { getAd } from "@/lib/db/ads";
import { publicUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ad = await getAd(id);
  if (!ad?.image_path) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(publicUrl("ad-images", ad.image_path), 307);
}
