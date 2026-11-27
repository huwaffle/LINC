import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { sqlite } from "@/lib/db/client";
import { csvTimestamp as timestamp, toCsv, type CsvCell } from "@/lib/csv";

export const runtime = "nodejs";

/** Admin-only CSV snapshots for the evaluation chapter of the thesis. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dataset: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return new NextResponse("Administrator access required", { status: 403 });
  }

  const { dataset } = await params;

  if (dataset === "entries") {
    const rows = await sqlite
      .prepare(
        `select e.id, e.title, e.status, c.label as category,
                u.username as author, u.display_name as author_name, e.is_anonymous,
                e.created_at, e.updated_at
         from entries e
         join categories c on c.id = e.category_id
         join users u on u.id = e.author_id
         order by e.created_at desc`,
      )
      .all() as Array<Record<string, CsvCell>>;

    const csv = toCsv(
      rows.map((row) => ({ ...row, created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at) })),
      [
        { key: "id", label: "id" },
        { key: "title", label: "title" },
        { key: "status", label: "status" },
        { key: "category", label: "category" },
        { key: "author", label: "author_username" },
        { key: "author_name", label: "author_display_name" },
        { key: "is_anonymous", label: "is_anonymous" },
        { key: "created_at", label: "created_at" },
        { key: "updated_at", label: "updated_at" },
      ],
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="linc-entries.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  if (dataset === "reports") {
    const rows = await sqlite
      .prepare(
        `select r.id, e.title as entry, u.username as reporter, r.reason, r.created_at, r.resolved_at
         from reports r join entries e on e.id = r.entry_id join users u on u.id = r.reporter_id
         order by r.created_at desc`,
      )
      .all() as Array<Record<string, CsvCell>>;

    const csv = toCsv(
      rows.map((row) => ({
        ...row,
        created_at: timestamp(row.created_at),
        resolved_at: timestamp(row.resolved_at),
      })),
      [
        { key: "id", label: "id" },
        { key: "entry", label: "entry" },
        { key: "reporter", label: "reporter_username" },
        { key: "reason", label: "reason" },
        { key: "created_at", label: "created_at" },
        { key: "resolved_at", label: "resolved_at" },
      ],
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="linc-reports.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  if (dataset === "moderation") {
    const rows = await sqlite
      .prepare(
        `select l.id, e.title as entry, u.username as actor, l.from_status, l.to_status,
                l.reason, l.created_at
         from moderation_log l join entries e on e.id = l.entry_id join users u on u.id = l.actor_id
         order by l.created_at desc`,
      )
      .all() as Array<Record<string, CsvCell>>;

    const csv = toCsv(
      rows.map((row) => ({ ...row, created_at: timestamp(row.created_at) })),
      [
        { key: "id", label: "id" },
        { key: "entry", label: "entry" },
        { key: "actor", label: "actor_username" },
        { key: "from_status", label: "from_status" },
        { key: "to_status", label: "to_status" },
        { key: "reason", label: "reason" },
        { key: "created_at", label: "created_at" },
      ],
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="linc-moderation.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse("Unknown dataset", { status: 404 });
}
