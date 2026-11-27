import type { SessionUser } from "./auth/token";

type EntryScope = { status: string };

/**
 * Single server-side authorization policy for the whole application.
 *
 * There are two roles: the USC administrator moderates everything, and students
 * manage their own content. Custom sessions do not map to Supabase Auth, so
 * every mutation and scoped read goes through these predicates. RLS policies
 * exist as a second layer for direct database clients; the service-role server
 * connection intentionally bypasses them.
 */
export function can(user: SessionUser | null) {
  return {
    isSignedIn: (): boolean => Boolean(user),

    /** Anyone may read published content; drafts and queues are admin-only. */
    readPublished: (): boolean => true,

    viewUnpublished: (_entry: EntryScope): boolean => user?.role === "admin",

    /** Authors can preview and edit their own non-anonymous drafts. */
    viewOwnDraft: (entry: { authorId: string; isAnonymous: boolean }): boolean =>
      Boolean(user && !entry.isAnonymous && entry.authorId === user.id),

    submitEntry: (): boolean => Boolean(user),

    comment: (): boolean => Boolean(user),

    rsvp: (): boolean => Boolean(user),

    report: (): boolean => Boolean(user),

    moderate: (_entry: EntryScope): boolean => user?.role === "admin",

    publishEvent: (): boolean => user?.role === "admin",

    adminOnly: (): boolean => user?.role === "admin",
  };
}

export type Policy = ReturnType<typeof can>;
