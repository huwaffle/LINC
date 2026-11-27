import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/linc/page-header";

export const metadata: Metadata = { title: "About · LINC" };

const SECTIONS = [
  {
    id: "terms",
    title: "LINC Terms",
    body: "LINC is a demonstration of a campus information and student engagement system. Use it respectfully: submissions are reviewed by the USC administrator, and content that targets or harms another person may be removed. Do not upload sensitive files that you would not want stored in the Supabase project.",
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    body: "Accounts, posts, comments, reactions, and uploaded media are stored in the Supabase PostgreSQL database and Storage buckets. Anonymous submissions use a separate pseudonymous author row, and receipt codes are stored only as keyed hashes."
  },
  {
    id: "cookies",
    title: "Cookies Policy",
    body: "The only cookie is the essential httpOnly session cookie used to keep you signed in. There are no analytics, advertising, or third-party tracking cookies. Your light/dark preference is stored in localStorage in this browser.",
  },
  {
    id: "cookie-settings",
    title: "Cookie Settings",
    body: "This demonstration does not use optional cookies, so there is nothing to opt in or out of. Clearing your browser storage removes the saved theme preference; signing out clears the session cookie.",
  },
] as const;

export default function AboutPage() {
  return (
    <div>
      <PageHeader title="About LINC" backHref="/" backLabel="Back to feed" />
      <div className="space-y-5 px-4 py-5">
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-20">
            <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">{section.title}</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-600">{section.body}</p>
          </section>
        ))}

        <section id="report" className="scroll-mt-20 border-t border-line pt-4">
          <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">Report a problem</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-600">
            Spotted a broken flow or content that needs administrator review? Submit a concern and
            the USC administrator will see it in the moderation queue.
          </p>
          <Link
            href="/submit"
            className="mt-3 inline-flex rounded-full bg-linc-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-linc-700"
          >
            Submit a concern
          </Link>
        </section>
      </div>
    </div>
  );
}
