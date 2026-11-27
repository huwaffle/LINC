import { NextResponse } from "next/server";
import { sweepReminders } from "@/lib/reminders";

export const runtime = "nodejs";

export async function POST() {
  const queued = await sweepReminders();
  return NextResponse.json({ ok: true, queued });
}

export async function GET() {
  const queued = await sweepReminders();
  return NextResponse.json({ ok: true, queued });
}
