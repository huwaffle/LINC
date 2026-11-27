import { sqlite } from "./db/client";
import { newId } from "./db/users";

/**
 * Turns due event reminders into outbox rows. Shared by the local worker
 * script and the /api/jobs/reminders route.
 */
export async function sweepReminders(): Promise<number> {
  const rows = await sqlite
    .prepare(
      `select r.id as reminder_id, r.event_id, r.user_id, e.title, e.starts_at
       from event_reminders r
       join events e on e.id = r.event_id
       
       where r.sent_at is null and r.send_at <= ?
       limit 500`,
    )
    .all(Date.now()) as Array<{
    reminder_id: string;
    event_id: string;
    user_id: string;
    title: string;
    starts_at: number;
  }>;

  if (rows.length === 0) return 0;

  const now = Date.now();
  const markSent = sqlite.prepare("update event_reminders set sent_at = ? where id = ?");
  const insertOutbox = sqlite.prepare(
    `insert into outbox (id, kind, to_role, to_user_id, subject, body, href, created_at, read_at)
     values (?, 'event-reminder', null, ?, ?, ?, '/events', ?, null)
     on conflict do nothing`,
  );

  await sqlite.transaction(async () => {
    for (const row of rows) {
      const when = new Date(row.starts_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
      await insertOutbox.run(
        newId("outbox"),
        row.user_id,
        `Reminder: ${row.title}`,
        `This is a reminder that "${row.title}" hosted by the USC starts on ${when}. Check the events page for details and your registration link.`,
        now,
      );
      await markSent.run(now, row.reminder_id);
    }
  });

  return rows.length;
}
