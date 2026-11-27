import { AdminConsole } from "@/components/linc/admin-console";
import { requireRole } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("admin");
  return <AdminConsole session={session}>{children}</AdminConsole>;
}
