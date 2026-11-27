import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase Storage adapter. The service-role key is used only in
 * Next.js server code; it never ships to the browser.
 */

export type Bucket = "attachments" | "avatars" | "ad-images";

let client: SupabaseClient | null = null;

function storage(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for file storage.",
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export async function uploadFile(
  bucket: Bucket,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const { error } = await storage()
    .storage.from(bucket)
    .upload(path, bytes, { contentType, upsert: true, cacheControl: "3600" });
  if (error) throw error;
}

export async function removeFile(bucket: Bucket, path: string): Promise<void> {
  const { error } = await storage().storage.from(bucket).remove([path]);
  if (error) throw error;
}

/**
 * Download an object. For private buckets a short-lived signed URL is used so
 * the service-role key is never exposed to the browser.
 */
export function publicUrl(bucket: Bucket, path: string): string {
  return storage().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function downloadFile(
  bucket: Bucket,
  path: string,
  range?: string | null,
): Promise<{
  data: Uint8Array;
  contentType: string | null;
  total: number;
  partial: boolean;
  contentRange: string | null;
}> {
  const supabase = storage();
  const from = supabase.storage.from(bucket);
  const isPublic = bucket !== "attachments";
  const url = isPublic
    ? from.getPublicUrl(path).data.publicUrl
    : (await from.createSignedUrl(path, 60, { download: false })).data?.signedUrl;

  if (!url) throw new Error(`Unable to resolve storage object ${bucket}/${path}`);

  const response = await fetch(url, {
    headers: range ? { Range: range } : undefined,
    cache: "no-store",
  });
  if (!response.ok && response.status !== 206) {
    throw new Error(`Storage object ${bucket}/${path} returned ${response.status}`);
  }

  const partial = response.status === 206;
  const contentRange = response.headers.get("content-range");
  const total = contentRange
    ? Number(contentRange.split("/")[1])
    : Number(response.headers.get("content-length") ?? 0);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    data: bytes,
    contentType: response.headers.get("content-type"),
    total: Number.isFinite(total) ? total : bytes.byteLength,
    partial,
    contentRange: response.headers.get("content-range"),
  };
}

/** Remove an object but never fail a user-facing mutation because of cleanup. */
export async function removeFileQuietly(bucket: Bucket, path: string | null): Promise<void> {
  if (!path) return;
  try {
    await removeFile(bucket, path);
  } catch {
    // The database row is the source of truth; a missing object is harmless.
  }
}
