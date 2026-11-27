import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthArt } from "@/components/linc/auth-art";
import { ResetForm } from "@/components/linc/reset-form";
import { ThemeToggle } from "@/components/linc/theme-toggle";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Reset password · LINC" };

export default async function ForgotPasswordPage({
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
        title="Back in, Lasallian."
        caption="Use the recovery code you saved when you created your account."
      />
      <div className="relative flex flex-col items-center justify-center px-6 py-10">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-[360px]">
          <h1 className="text-[26px] font-black tracking-[-0.04em] text-ink">Reset password</h1>
          <p className="mt-1 text-[13px] text-neutral-500">
            Enter your recovery code and choose a new password.
          </p>

          {error && (
            <p className="mt-6 border-l-2 border-rose-400 py-1 pl-3 text-[13px] text-rose-700">
              {error}
            </p>
          )}

          <ResetForm error={error} />

          <p className="mt-5 text-center text-[13px] text-neutral-500">
            <Link href="/login" className="font-semibold text-linc-700 hover:underline">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
