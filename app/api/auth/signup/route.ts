import { NextResponse } from "next/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/provider";
import { RECOVERY_COOKIE, generateRecoveryCode, hashPassword, hashRecoveryCode, isSchoolEmail } from "@/lib/auth/password";
import { sqlite } from "@/lib/db/client";
import { displayNameTaken, ensureUser } from "@/lib/db/users";
import { scheduleContentScan } from "@/lib/moderation/safety";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSessionToken } from "@/lib/auth/token";

export const runtime = "nodejs";

function back(request: Request, error: string) {
  const target = new URL("/signup", request.url);
  target.searchParams.set("error", error);
  return NextResponse.redirect(target, { status: 303 });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const studentNumber = String(form.get("studentNumber") ?? "").trim();
  const displayName = String(form.get("displayName") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const agreed = form.get("agree") === "on";

  if (!isSchoolEmail(email)) return back(request, "Use your @dlsau.edu.ph email address.");
  if (!/^\d{4,}$/.test(studentNumber)) return back(request, "Enter a valid student number (digits only).");
  if (!displayName || displayName.length > 60) return back(request, "Add a username of 60 characters or fewer.");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return back(request, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password !== confirm) return back(request, "Passwords do not match.");
  if (!agreed) return back(request, "You must read and accept the Privacy Policy and Terms and Conditions.");

  if (await sqlite.prepare("select 1 from users where email = ?").get(email)) {
    return back(request, "That email is already registered.");
  }
  if (await sqlite.prepare("select 1 from users where id = ? or username = ?").get(`user-${studentNumber}`, studentNumber)) {
    return back(request, "That student number is already registered.");
  }
  if (await displayNameTaken(displayName)) return back(request, "That username is already taken.");

  const user = {
    id: `user-${studentNumber}`,
    username: studentNumber,
    role: "student" as const,
    displayName,
  };

  const recoveryCode = generateRecoveryCode();
  try {
    await sqlite.transaction(async () => {
      await ensureUser(user);
      await sqlite
        .prepare(
          "update users set email = ?, password_hash = ?, recovery_code_hash = ?, terms_accepted_at = ? where id = ?",
        )
        .run(email, hashPassword(password), hashRecoveryCode(recoveryCode), Date.now(), user.id);
    });
  } catch {
    return back(request, "That email or student number is already registered.");
  }

  // Check the new display name for profanity in the background so signup never
  // waits on the moderation service. Findings surface in /admin/safety.
  scheduleContentScan("account", user.id);

  const token = await signSessionToken(user);
  const response = NextResponse.redirect(new URL("/signup/recovery", request.url), { status: 303 });
  response.cookies.set(RECOVERY_COOKIE, recoveryCode, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/signup",
    maxAge: 15 * 60,
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
