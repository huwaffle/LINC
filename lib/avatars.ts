/**
 * Public URL for an account's uploaded profile picture. Anonymous author rows
 * never have an avatar, so they fall back to the initial-letter badge.
 */
export function avatarSrc(
  userId: string,
  hasAvatar: boolean | number | null | undefined,
): string | undefined {
  return hasAvatar ? `/api/avatars/${userId}` : undefined;
}
