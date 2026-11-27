import { NextResponse } from "next/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/provider";
import {
  RECOVERY_COOKIE,
  generateRecoveryCode,
  hashPassword,
  hashRecoveryCode,
  verifyRecoveryCode,
} from "@/lib/auth/password";
import { sqlite } from "@/lib/db/client";
import { hitLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function back(request: Request, error: string) {
  const target = new URL("/forgot-password", request.url);
  target.searchParams.set("error", error);
  return NextResponse.redirect(target, { status: 303 });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const key = String(form.get("username") ?? "").trim().toLowerCase();
  const code = String(form.get("code") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return back(request, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password !== confirm) return back(request, "Passwords do not match.");
  if (!await hitLimit(`reset:${key}`, 5, 15 * 60_000)) {
    return back(request, "Too many attempts. Try again in a few minutes.");
  }

  const row = await sqlite
    .prepare(
      "select id, recovery_code_hash from users where (email = ? or username = ?) and password_hash is not null",
    )
    .get(key, key) as { id: string; recovery_code_hash: string | null } | undefined;

  if (!row?.recovery_code_hash || !verifyRecoveryCode(code, row.recovery_code_hash)) {
    return back(request, "Those details do not match a recovery code on file.");
  }

  const newCode = generateRecoveryCode();
  await sqlite
    .prepare("update users set password_hash = ?, recovery_code_hash = ? where id = ?")
    .run(hashPassword(password), hashRecoveryCode(newCode), row.id);

  const response = NextResponse.redirect(new URL("/signup/recovery?reset=1", request.url), {
    status: 303,
  });
  response.cookies.set(RECOVERY_COOKIE, newCode, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/signup",
    maxAge: 15 * 60,
  });
  return response;
}
