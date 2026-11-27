/**
 * Shared database value types.
 *
 * The application talks to Supabase PostgreSQL through lib/db/client.ts. The
 * canonical SQL schema lives in supabase/migrations/0001_init.sql.
 */

export type EntryStatus = "draft" | "pending" | "published" | "rejected" | "redacted";
export type SafetySeverity = "low" | "medium" | "high";
export type SafetyStatus = "open" | "reviewed" | "dismissed";
export type TargetType = "entry" | "account" | "comment";
