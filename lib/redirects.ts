import { redirect } from "next/navigation";

export function fail(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}error=${encodeURIComponent(message)}`);
}

export function done(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}notice=${encodeURIComponent(message)}`);
}

export function messageFrom(params: { error?: string; notice?: string }): {
  kind: "error" | "success" | null;
  text: string | null;
} {
  if (params.error) return { kind: "error", text: params.error };
  if (params.notice) return { kind: "success", text: params.notice };
  return { kind: null, text: null };
}
