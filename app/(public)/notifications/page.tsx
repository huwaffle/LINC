import { redirect } from "next/navigation";

/** Notifications are now part of the merged Activity feed. */
export default function NotificationsPage() {
  redirect("/activity");
}
