import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { sqlite } from "@/lib/db/client";
import { downloadFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const attachment = await sqlite
    .prepare(
      `select a.filename, a.mime_type, a.storage_path, e.status
       from attachments a join entries e on e.id = a.entry_id
       where a.id = ?`,
    )
    .get(id) as
    | { filename: string; mime_type: string; storage_path: string; status: string }
    | undefined;

  if (!attachment) return new NextResponse("Not found", { status: 404 });

  // Pictures on published posts are part of the public feed. Media that is
  // still in review stays behind a session so it cannot be pulled by URL.
  const session = await getSession();
  if (!session && attachment.status !== "published") {
    return new NextResponse("Sign in required", { status: 401 });
  }

  // Private attachments are read through a short-lived signed URL issued by
  // the service-role Storage client; the browser never sees that credential.
  const range = request.headers.get("range");
  let object;
  try {
    object = await downloadFile("attachments", attachment.storage_path, range);
  } catch {
    return new NextResponse("File missing", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": attachment.mime_type,
    "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.filename)}"`,
    "Cache-Control": session ? "private, max-age=60" : "public, max-age=300",
    "Accept-Ranges": "bytes",
  };

  if (object.partial) {
    return new NextResponse(new Uint8Array(object.data), {
      status: 206,
      headers: {
        ...headers,
        ...(object.contentRange ? { "Content-Range": object.contentRange } : {}),
        "Content-Length": String(object.data.byteLength),
      },
    });
  }

  return new NextResponse(new Uint8Array(object.data), {
    headers: { ...headers, "Content-Length": String(object.data.byteLength) },
  });
}
