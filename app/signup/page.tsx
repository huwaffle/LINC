import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthArt } from "@/components/linc/auth-art";
import { SignupForm } from "@/components/linc/signup-form";
import { ThemeToggle } from "@/components/linc/theme-toggle";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create account · LINC" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/");

  const { error } = await searchParams;

  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-2">
      <AuthArt
        title="Join the Lasallian community."
        caption="Create your LINC account to post, react, and follow what is happening on campus."
      />
      <div className="relative flex flex-col items-center justify-center px-6 py-10">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-[360px]">
          <h1 className="text-[26px] font-black tracking-[-0.04em] text-ink">Create account</h1>
          <p className="mt-1 text-[13px] text-neutral-500">Students only. Use your @dlsau.edu.ph email.</p>

          {error && (
            <p className="mt-6 border-l-2 border-rose-400 py-1 pl-3 text-[13px] text-rose-700">
              {error}
            </p>
          )}

          <SignupForm error={error} />

          <p className="mt-5 text-center text-[13px] text-neutral-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-linc-700 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
