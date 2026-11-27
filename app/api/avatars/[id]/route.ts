import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import { publicUrl } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Serves an account's uploaded profile picture. Avatars belong to real
 * accounts only; pseudonymous authors always fall back to the neutral badge.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await sqlite
    .prepare(`select avatar_path, is_anonymous from users where id = ?`)
    .get(id) as
    | { avatar_path: string | null; is_anonymous: number }
    | undefined;

  if (!user || user.is_anonymous || !user.avatar_path) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.redirect(publicUrl("avatars", user.avatar_path), 307);
}
