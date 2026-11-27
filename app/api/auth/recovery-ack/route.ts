import { NextResponse } from "next/server";
import { RECOVERY_COOKIE } from "@/lib/auth/password";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const to = form.get("to") === "/login" ? "/login" : "/";
  const response = NextResponse.redirect(new URL(to, request.url), { status: 303 });
  response.cookies.set(RECOVERY_COOKIE, "", { path: "/signup", maxAge: 0 });
  return response;
}
