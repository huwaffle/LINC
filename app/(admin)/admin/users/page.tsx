export const dynamic = "force-dynamic";

import { listUsers } from "@/lib/db/queries";
import { formatDate } from "@/lib/format";

const ROLE_STYLE: Record<string, string> = {
  admin: "bg-ink text-white",
  student: "bg-neutral-100 text-neutral-600",
};

export default async function UsersPage() {
  const users = await listUsers(200);
  const counts = users.reduce<Record<string, number>>((acc, user) => {
    acc[user.role] = (acc[user.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="px-4 py-4">
        <h1 className="text-[19px] font-bold tracking-[-0.02em] text-ink">Registered users</h1>
        <p className="text-[13px] leading-relaxed text-neutral-500">
          Accounts are created on first login. Anonymous submissions appear as pseudonymous rows and
          cannot be reversed from here.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pb-3 text-[11px]">
        <span className="rounded-full border border-line px-2.5 py-1 font-semibold text-neutral-600">
          {users.length} total
        </span>
        <span className="rounded-full border border-line px-2.5 py-1 font-semibold text-neutral-600">
          {counts.student ?? 0} students
        </span>
        <span className="rounded-full border border-line px-2.5 py-1 font-semibold text-neutral-600">
          {counts.admin ?? 0} admin
        </span>
      </div>

      <table className="w-full border-collapse text-left max-sm:block">
        <thead className="max-sm:sr-only">
          <tr className="border-y border-line text-[11px] uppercase tracking-wide text-neutral-400">
            <th className="px-4 py-2 font-semibold">User</th>
            <th className="px-4 py-2 font-semibold">Role</th>
            <th className="max-sm:block max-sm:!px-0 max-sm:py-0.5 max-sm:text-neutral-500 px-4 py-2 font-semibold">Entries</th>
            <th className="max-sm:block max-sm:!px-0 max-sm:py-0.5 max-sm:text-neutral-500 sm:hidden lg:table-cell px-4 py-2 font-semibold lg:table-cell">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line max-sm:block">
          {users.map((user) => (
            <tr key={user.id} className="max-sm:block max-sm:px-4 max-sm:py-1 transition hover:bg-neutral-50/60">
              <td className="max-sm:block max-sm:!px-0 px-4 py-2.5">
                <p className="text-[13px] font-semibold text-ink">{user.display_name}</p>
                <p className="font-mono text-[11px] text-neutral-400">{user.username}</p>
              </td>
              <td className="max-sm:block max-sm:!px-0 px-4 py-2.5">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE_STYLE[user.role] ?? "bg-neutral-100"}`}
                >
                  {user.role}
                </span>
              </td>
              <td className="max-sm:block max-sm:!px-0 max-sm:py-0.5 max-sm:text-neutral-500 px-4 py-2.5 text-[12px] text-neutral-600">
                {user.entry_count}
              </td>
              <td className="max-sm:block max-sm:!px-0 max-sm:py-0.5 max-sm:text-neutral-500 sm:hidden lg:table-cell px-4 py-2.5 text-[11px] text-neutral-400 lg:table-cell">
                {formatDate(user.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
