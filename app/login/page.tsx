import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthArt } from "@/components/linc/auth-art";
import { LegalLinks } from "@/components/linc/legal-links";
import { LoginForm } from "@/components/linc/login-form";
import { ThemeToggle } from "@/components/linc/theme-toggle";
import { LOGIN_LOCK_MS, LOGIN_MAX_FAILURES } from "@/lib/auth/login-lock";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in · LINC" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    next?: string;
    remaining?: string;
    retryAfter?: string;
  }>;
}) {
  const session = await getSession();
  if (session) redirect("/");

  const { error, next, remaining, retryAfter } = await searchParams;
  const parsedRemaining = Number.parseInt(remaining ?? "", 10);
  const remainingTries =
    Number.isFinite(parsedRemaining) &&
    parsedRemaining > 0 &&
    parsedRemaining < LOGIN_MAX_FAILURES
      ? parsedRemaining
      : null;
  const parsedRetryAfter = Number.parseInt(retryAfter ?? "", 10);
  // The server only sends retryAfter once the identifier is actually locked.
  // That is true on the fifth failure too, whose error is still the base reason.
  const isLockout = Boolean(error) && remaining === "0";
  const lockMs =
    isLockout && Number.isFinite(parsedRetryAfter) && parsedRetryAfter > 0
      ? Math.min(parsedRetryAfter * 1000, LOGIN_LOCK_MS)
      : 0;

  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-2">
    <AuthArt
      eyebrow="Your campus, in the loop"
      title="Welcome back, Lasallian!"
      caption="There's always something happening on campus. Sign in to catch the latest announcements, events, and conversations from your community."
    />
    <div className="relative flex flex-col items-center justify-center px-6 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[360px]">
        <div className="flex flex-col items-center">
          <h1 className="text-[38px] font-black tracking-[-0.04em] text-linc-600">LINC</h1>
          <p className="mt-1 text-center text-[13px] leading-relaxed text-neutral-500">
            Lasallian Information Network and Community
          </p>
        </div>

        {error && (
          <div className="mt-6 space-y-1.5">
            <p className="border-l-2 border-rose-400 py-1 pl-3 text-[13px] text-rose-700">
              {error}
            </p>
            {remainingTries && (
              <p
                role="status"
                className="border-l-2 border-amber-400 py-1 pl-3 text-[12px] font-semibold text-amber-700"
              >
                {remainingTries} {remainingTries === 1 ? "try" : "tries"} left before this sign-in
                is locked for 3 minutes.
              </p>
            )}
          </div>
        )}

        <LoginForm next={next} error={error} lockMs={lockMs} />

        <p className="mt-5 text-center text-[13px] text-neutral-500">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-linc-700 hover:underline">
            Create account
          </Link>
        </p>

        <Link
          href="/"
          className="mt-4 block text-center text-[13px] font-semibold text-neutral-500 transition hover:text-ink"
        >
          Continue to the public feed
        </Link>

        <LegalLinks />
      </div>
    </div>
    </div>
  );
}
