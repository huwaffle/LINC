"use server";

import { revalidatePath } from "next/cache";
import { done, fail } from "@/lib/redirects";
import {
  clearReceiptNotice,
  clearTracking,
  findReceipt,
  rememberTracking,
} from "@/lib/receipts";
import { normalizeReceiptCode } from "@/lib/receipt-code";

/** Attaches a manually entered receipt code to this browser. */
export async function trackReceipt(formData: FormData): Promise<void> {
  const code = normalizeReceiptCode(String(formData.get("code") ?? ""));
  if (!code) {
    fail("/track", "Enter the 12-character tracking code.");
  }

  if (!await findReceipt(code)) {
    fail("/track", "No post matches that tracking code.");
  }

  await rememberTracking(code);
  revalidatePath("/track");
  done("/track", "Receipt attached on this device.");
}

/** Called by /track when the tracked receipt no longer matches an entry. */
export async function forgetMissingReceipt(): Promise<void> {
  await clearTracking();
  revalidatePath("/track");
  done("/track", "That receipt is no longer available. Tracking was cleared.");
}

/** The submitter confirms they saved the code shown on /receipt. */
export async function dismissReceipt(): Promise<void> {
  await clearReceiptNotice();
  revalidatePath("/receipt");
  done("/track", "Your receipt is saved on this device. Keep the code somewhere safe.");
}

export async function stopTracking(): Promise<void> {
  await clearTracking();
  revalidatePath("/track");
  done("/track", "Receipt tracking stopped on this device.");
}
