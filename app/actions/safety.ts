"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { sqlite } from "@/lib/db/client";
import { hitLimit } from "@/lib/rate-limit";
import { done, fail } from "@/lib/redirects";
import { runFullSafetyScan } from "@/lib/moderation/safety";
import {
  deleteSafetyTerm,
  invalidateSafetyChecks,
  isSafetySeverity,
  saveSafetyTerm,
  validateSafetyTerm,
} from "@/lib/moderation/terms";

const RESOLUTIONS = new Set(["reviewed", "dismissed"]);

export async function runSafetyScan(): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Administrator access required.");
  if (session.role !== "admin") fail("/", "Administrator access required.");

  if (!await hitLimit(`safety-scan:${session.id}`, 5, 10 * 60_000)) {
    fail("/admin/safety", "You have run several scans recently. Please wait a few minutes.");
  }

  const result = await runFullSafetyScan();

  revalidatePath("/admin");
  revalidatePath("/admin/safety");
  revalidatePath("/admin/outbox");

  const method =
    result.provider === "gemini"
      ? `Gemini (${result.model})`
      : "the offline lexicon (set GEMINI_API_KEY for contextual scanning)";
  done(
    "/admin/safety",
    `Scanned ${result.scannedEntries} posts, ${result.scannedComments} comments, and ${result.scannedAccounts} accounts with ${method}. ${result.flagged} item${
      result.flagged === 1 ? "" : "s"
    } flagged, ${result.noteworthy} alert${result.noteworthy === 1 ? "" : "s"} sent${
      result.created > 0 ? `, ${result.created} new` : ""
    }${result.reopened > 0 ? `, ${result.reopened} reopened` : ""}.`,
  );
}

export async function addSafetyTerm(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Administrator access required.");
  if (session.role !== "admin") fail("/", "Administrator access required.");

  if (!await hitLimit(`safety-term:${session.id}`, 30, 10 * 60_000)) {
    fail("/admin/safety", "You are editing filters too quickly. Try again shortly.");
  }

  const validated = validateSafetyTerm(String(formData.get("term") ?? ""));
  if (!validated.ok) fail("/admin/safety", validated.error);

  const rawSeverity = String(formData.get("severity") ?? "medium");
  const severity = isSafetySeverity(rawSeverity) ? rawSeverity : "medium";
  const outcome = await saveSafetyTerm(validated.term, severity, session.id);

  // Cached scans were produced under the old filter list, so clear them.
  await invalidateSafetyChecks();

  revalidatePath("/admin");
  revalidatePath("/admin/safety");

  done(
    "/admin/safety",
    outcome === "created"
      ? `Added "${validated.term}" as a ${severity}-risk filter. Run a full scan to re-check existing content.`
      : `Updated "${validated.term}" to ${severity}-risk. Run a full scan to re-check existing content.`,
  );
}

export async function removeSafetyTerm(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Administrator access required.");
  if (session.role !== "admin") fail("/", "Administrator access required.");

  const id = String(formData.get("id") ?? "").trim();
  if (!id || !(await deleteSafetyTerm(id))) {
    fail("/admin/safety", "That offensive word filter no longer exists.");
  }

  await invalidateSafetyChecks();

  revalidatePath("/admin");
  revalidatePath("/admin/safety");

  done("/admin/safety", "Offensive word filter removed.");
}

export async function resolveSafetyFlag(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Administrator access required.");
  if (session.role !== "admin") fail("/", "Administrator access required.");

  const flagId = String(formData.get("flagId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!flagId || !RESOLUTIONS.has(status)) {
    fail("/admin/safety", "That safety action is not valid.");
  }

  const result = await sqlite
    .prepare(
      "update safety_flags set status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? where id = ?",
    )
    .run(status, session.id, Date.now(), Date.now(), flagId);

  revalidatePath("/admin");
  revalidatePath("/admin/safety");
  revalidatePath("/admin/outbox");

  if (result.changes === 0) fail("/admin/safety", "That flag no longer exists.");
  done(
    "/admin/safety",
    status === "reviewed" ? "Flag marked as reviewed." : "Flag dismissed.",
  );
}
