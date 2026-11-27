import fs from "node:fs";
import path from "node:path";
import type { SqliteDatabase } from "./client";
import { hashPassword } from "../auth/password";
import { uploadFile } from "../storage";
import {
  DEMO_ACCOUNT_PASSWORD,
  DEMO_ADMIN,
  DEMO_STUDENTS,
  studentDisplayName,
  studentEmail,
  studentId,
  studentUsername,
} from "../auth/demo-accounts";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIES = [
  ["announcements", "Announcements", "Official notices from the university and its offices."],
  ["concerns", "Concerns", "Issues raised by students about services, facilities, and policies."],
  ["academic", "Academic", "Enrollment, subjects, grades, and academic support."],
  ["events", "Events", "University activities, seminars, and campus-wide programs."],
  ["services", "Services", "Guidance, health, library, and student welfare services."],
  ["policies", "Policies", "Clarifications on university rules and implementing guidelines."],
  ["suggestions", "Suggestions", "Ideas to improve the campus, services, and student life."],
  ["inquiries", "Inquiries", "Questions for university offices. Ask where to go or who to approach."],
  ["organizations", "Organizations", "Clubs, org recruitment, and student organization updates."],
  ["opportunities", "Opportunities", "Internships, jobs, competitions, and scholarships beyond the campus."],
  ["study-hub", "Study Hub", "Reviewers, study groups, and shared learning resources."],
  ["freedom-wall", "Freedom Wall", "Say what is on your mind, confessions and shoutouts. Be kind and respectful."],
  ["memes", "Memes", "Campus humor. Keep it funny, keep it clean."],
  ["lost-found", "Lost & Found", "Report and recover misplaced belongings within campus."],
  ["marketplace", "Marketplace", "Buy, sell, lend, or look for items within the Lasallian community."],
  ["general", "General", "Anything else the Lasallian community should know."],
] as const;

const TITLES: Record<string, string[]> = {
  announcements: [
    "Updated shuttle schedule for the Malabon campus",
    "Library extends operating hours during finals",
    "Enrollment for the second semester opens next week",
    "University-wide clean-up drive this Saturday",
    "Scholarship applications now being accepted",
    "Health services announces free consultation week",
  ],
  concerns: [
    "Air conditioning units in Room 402 are not working",
    "Water dispensers on the third floor need refilling",
    "Long queues at the registrar during lunch break",
    "Wifi signal is unstable inside the laboratory",
    "Lighting along the north walkway needs repair",
    "Comfort rooms near the gym lack supplies",
  ],
  academic: [
    "Library opens additional group study rooms",
    "Guidelines for late enrollment and subject petitions",
    "Thesis advising slots available for graduating students",
    "Remedial sessions for Data Structures announced",
    "Grade consultation schedule for the midterm",
    "Laboratory make-up classes for suspended sessions",
  ],
  events: [
    "Career fair brings fifteen partner companies",
    "Inter-college quiz bee returns this October",
    "CAST week opens with a technology showcase",
    "CVMAS holds its annual animal welfare drive",
    "COED hosts a seminar on inclusive teaching",
    "USC organizes a general assembly for all students",
  ],
  services: [
    "Food assistance program expands to evening classes",
    "New online booking for clinic consultations",
    "Student assistance desk relocated to the ground floor",
    "Peer tutoring program now accepting volunteers",
    "Guidance office opens walk-in counseling slots",
    "Lost ID replacement now processed in one day",
  ],
  policies: [
    "Clarification on the revised dress code policy",
    "Guidelines for excused absences during competitions",
    "Policy on the use of AI tools in coursework",
    "Implementing rules for the no-smoking campus policy",
    "Clarification on the grading appeals process",
    "Rules for overnight use of laboratory facilities",
  ],
  "lost-found": [
    "Found: black wallet near the cafeteria",
    "Lost: scientific calculator in Room 305",
    "Found: student ID inside the library",
    "Lost: blue umbrella at the main lobby",
    "Found: set of keys near the parking area",
    "Lost: eyeglasses in the computer laboratory",
  ],
  marketplace: [
    "Selling: pre-loved laboratory coat, size M",
    "Looking for: second-hand engineering calculator",
    "For rent: drafting table for the semester",
    "Selling: set of accounting textbooks",
    "Free: extra thesis binders and folders",
    "Looking for: roommate near the Malabon campus",
  ],
  general: [
    "Reminder on proper disposal of laboratory waste",
    "Campus security advisory for evening classes",
    "Call for volunteers for the outreach program",
    "Feedback form for the new student portal",
    "Schedule of the midterm examination week",
    "Invitation to join the campus journalism team",
  ],
  "suggestions": [
    "Add more charging stations in the library",
    "Extend cafeteria hours for evening classes",
    "Proposal for a student-run recycling program",
  ],
  "inquiries": [
    "Where can I ask about my scholarship status?",
    "Who handles shifting from one program to another?",
    "How do I request an official transcript?",
  ],
  "organizations": [
    "Photography club is now accepting new members",
    "Debate society holds open tryouts",
    "Robotics club invites freshmen to its first meeting",
  ],
  "opportunities": [
    "Internship openings for IT and business students",
    "National hackathon looking for student teams",
    "Scholarship for graduating students abroad",
  ],
  "study-hub": [
    "Free reviewer for Calculus 2 finals",
    "Looking for a study group in Organic Chemistry",
    "Shared notes for Philippine History",
  ],
  "freedom-wall": [
    "Shoutout to the guard who returned my umbrella",
    "Confession: I get lost in this campus every single day",
    "To whoever sings in the stairwell, please never stop",
  ],
  "memes": [
    "When the professor says it is an easy quiz",
    "Me pretending to understand the thesis defense schedule",
    "The wifi at 7 AM versus the wifi at 7 PM",
  ],
};

const BODIES: Record<string, string> = {
  announcements:
    "The Office of Student Affairs has released the official schedule. All students are advised to check their portal accounts and coordinate with the USC for clarifications. Please observe the posted deadlines to avoid delays in processing.",
  concerns:
    "Several students have raised this concern over the past week. We are consolidating the reports so the responsible office can act on them as a single item. Students who encounter the same issue are encouraged to reply with the date and time of occurrence.",
  academic:
    "The department has published the complete guidance for this matter. Students with conflicting schedules or outstanding requirements should consult their adviser before the end of the week. Requests submitted after the deadline will be handled on a case-to-case basis.",
  events:
    "The USC is inviting all Lasallians to participate in this activity. Registration is free and open to students from all colleges. Attendees are requested to arrive fifteen minutes early for the opening program.",
  services:
    "The office has adjusted its operations to accommodate more students. Walk-ins are still accepted, but booking ahead through the portal is encouraged to reduce waiting time. Bring a valid school ID for verification.",
  policies:
    "This clarification responds to questions raised during the consultation period. The policy takes effect immediately and applies to all undergraduate students. Concerns about specific cases may be raised through the university's concern form.",
  "lost-found":
    "If this item belongs to you, please proceed to the student assistance desk and describe the item before claiming it. Unclaimed items will be turned over to the security office after two weeks.",
  marketplace:
    "Item is available for pickup within campus. Send a reply with your preferred meet-up time and a way to verify ownership or fit. Transactions are between students; the university does not mediate payments.",
  general:
    "This notice is posted for the information of the Lasallian community. For questions, please contact the issuing office or the USC. Updates will be posted in this category as they become available.",
  "suggestions":
    "This idea comes from several students who would like the community to consider it. Please share your thoughts in the replies so the USC can see how many students support it.",
  "inquiries":
    "Posting this so other students with the same question can see the answer too. If you know the right office or have gone through this process, please reply with the steps.",
  "organizations":
    "Everyone is welcome to join, regardless of year level or college. Reply or message the organization officers for the schedule and the requirements.",
  "opportunities":
    "Details and the application link are provided by the organizer. Please check the deadline and the eligibility requirements before applying.",
  "study-hub":
    "Sharing this for anyone who needs it. Feel free to add your own notes or ask questions in the replies, and please give credit when you reuse materials.",
  "freedom-wall":
    "Posted for the community. Please keep the replies respectful; posts that attack individuals are reviewed by the USC administrator.",
  "memes":
    "Just for laughs. Keep the humor clean and do not target specific people.",
};

/**
 * Demo photos that ship in `storage/uploads` are uploaded to the Supabase
 * `attachments` bucket and attached to seeded posts. If a file is missing
 * locally, that post is simply seeded without media.
 */
const DEMO_ATTACHMENTS: Array<{ title: string; file: string; filename: string }> = [
  {
    title: "Updated shuttle schedule for the Malabon campus",
    file: "demo-shuttle.jpg",
    filename: "shuttle-at-the-gate.jpg",
  },
  {
    title: "Library opens additional group study rooms",
    file: "demo-library.jpg",
    filename: "library-reading-room.jpg",
  },
  {
    title: "Air conditioning units in Room 402 are not working",
    file: "demo-classroom.jpg",
    filename: "room-402.jpg",
  },
  {
    title: "Food assistance program expands to evening classes",
    file: "demo-food.jpg",
    filename: "food-assistance-packing.jpg",
  },
  {
    title: "Career fair brings fifteen partner companies",
    file: "demo-career.jpg",
    filename: "career-fair-booth.jpg",
  },
  {
    title: "Campus security advisory for evening classes",
    file: "demo-campus.webm",
    filename: "campus-walkthrough.webm",
  },
];

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  webm: "video/webm",
  mp4: "video/mp4",
};

export const SEEDED_STUDENT_USERNAMES: readonly string[] = DEMO_STUDENTS.map(studentUsername);

/**
 * Idempotently provisions the documented demo accounts: one USC administrator
 * and the real-named students. Every account has a scrypt password hash so the
 * login route verifies them like any database-backed account.
 *
 * Existing nicknames, avatars, and changed passwords are preserved except for
 * the password of the seeded demo rows, which this function resets so the
 * documented credentials always work after `db:reset` or `db:seed-accounts`.
 */
export async function seedDemoAccounts(sqlite: SqliteDatabase): Promise<void> {
  const now = Date.now();
  const passwordHash = hashPassword(DEMO_ACCOUNT_PASSWORD);
  const upsert = sqlite.prepare(
    `insert into users
       (id, username, role, display_name, is_anonymous, created_at,
        email, password_hash, terms_accepted_at)
     values (?, ?, ?, ?, 0, ?, ?, ?, ?)
     on conflict (id) do update set
       role = excluded.role,
       display_name = excluded.display_name,
       email = excluded.email,
       password_hash = excluded.password_hash,
       terms_accepted_at = coalesce(users.terms_accepted_at, excluded.terms_accepted_at)`,
  );

  await sqlite.transaction(async () => {
    await upsert.run(
      DEMO_ADMIN.id,
      DEMO_ADMIN.username,
      "admin",
      DEMO_ADMIN.displayName,
      now,
      DEMO_ADMIN.email,
      passwordHash,
      now,
    );

    for (const student of DEMO_STUDENTS) {
      await upsert.run(
        studentId(student),
        studentUsername(student),
        "student",
        studentDisplayName(student),
        now,
        studentEmail(student),
        passwordHash,
        now,
      );
    }
  });
}

export async function seed(sqlite: SqliteDatabase): Promise<void> {
  const now = Date.now();
  const rand = mulberry32(20261024);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

  const insertCategory = sqlite.prepare(
    "insert into categories (id, slug, label, description, sort_order) values (?, ?, ?, ?, ?) on conflict do nothing",
  );
  const insertAnonUser = sqlite.prepare(
    `insert into users (id, username, role, display_name, is_anonymous, created_at)
     values (?, ?, 'student', 'Anonymous Lasallian', 1, ?)`,
  );
  const insertEntry = sqlite.prepare(
    `insert into entries (id, author_id, category_id, title, body, status,
                          is_anonymous, reject_reason, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertModlog = sqlite.prepare(
    `insert into moderation_log (id, entry_id, actor_id, from_status, to_status, reason, created_at)
     values (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertAttachment = sqlite.prepare(
    `insert into attachments (id, entry_id, filename, mime_type, byte_size, storage_path, created_at)
     values (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertComment = sqlite.prepare(
    `insert into comments (id, entry_id, author_id, body, is_anonymous, created_at)
     values (?, ?, ?, ?, ?, ?)`,
  );
  const insertLike = sqlite.prepare(
    "insert into likes (id, entry_id, user_id, created_at) values (?, ?, ?, ?) on conflict do nothing",
  );
  const insertSave = sqlite.prepare(
    "insert into saves (id, entry_id, user_id, created_at) values (?, ?, ?, ?) on conflict do nothing",
  );
  const insertRepost = sqlite.prepare(
    "insert into reposts (id, entry_id, user_id, created_at) values (?, ?, ?, ?) on conflict do nothing",
  );
  const insertEvent = sqlite.prepare(
    `insert into events (id, organizer_id, title, description, location, registration_url, starts_at, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertRsvp = sqlite.prepare(
    "insert into rsvps (id, event_id, user_id, created_at) values (?, ?, ?, ?) on conflict do nothing",
  );
  const insertReminder = sqlite.prepare(
    "insert into event_reminders (id, event_id, user_id, send_at, sent_at) values (?, ?, ?, ?, null) on conflict do nothing",
  );
  const insertOutbox = sqlite.prepare(
    `insert into outbox (id, kind, to_role, to_user_id, subject, body, href, created_at, read_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, null)`,
  );

  // One USC administrator and real-named students, all with the demo password.
  await sqlite.transaction(async () => {
    await seedDemoAccounts(sqlite);

    // Categories
    for (const [i, [slug, label, description]] of CATEGORIES.entries()) {
      await insertCategory.run(`cat-${slug}`, slug, label, description, i);
    }

    const studentIds = [...SEEDED_STUDENT_USERNAMES];

    // Entries: 42 published, 8 pending, 6 rejected, 4 redacted
    const statuses: Array<"published" | "pending" | "rejected" | "redacted"> = [
      ...Array(42).fill("published"),
      ...Array(8).fill("pending"),
      ...Array(6).fill("rejected"),
      ...Array(4).fill("redacted"),
    ];

    const cats = CATEGORIES.map((c) => c[0]);
    const entryIds: string[] = [];
    const entryIdByTitle = new Map<string, string>();

    for (const [i, status] of (statuses).entries()) {
      const categorySlug = cats[i % cats.length];
      const titlePool = TITLES[categorySlug];
      const title = titlePool[Math.floor(i / cats.length) % titlePool.length];
      // Official notices come from the USC account; everything else is written
      // by one of the real-named student accounts.
      const official = ["announcements", "policies", "services"].includes(categorySlug);
      const isStudentAuthor = !official;
      const authorId = isStudentAuthor
        ? studentId(DEMO_STUDENTS[i % DEMO_STUDENTS.length])
        : DEMO_ADMIN.id;
      const isAnonymous = isStudentAuthor && (i === 7 || i === 23);
      const createdAt = now - (i + 1) * 8 * 3600_000 - Math.floor(rand() * 3_600_000);
      const id = `entry-${String(i + 1).padStart(3, "0")}`;
      entryIds.push(id);
      if (status === "published") entryIdByTitle.set(title, id);

      // Seeded anonymous posts get a pseudonymous author too, so the demo data
      // does not silently link an anonymous entry back to a student profile.
      let entryAuthorId = authorId;
      if (isAnonymous) {
        entryAuthorId = `user-anon-seed-${i + 1}`;
        await insertAnonUser.run(entryAuthorId, `anon-seed-${i + 1}`, now);
      }

      await insertEntry.run(
        id,
        entryAuthorId,
        `cat-${categorySlug}`,
        title,
        BODIES[categorySlug],
        status,
        isAnonymous ? 1 : 0,
        status === "rejected" ? "Off-topic for this category. Please resubmit under the correct section." : null,
        createdAt,
        createdAt + 3600_000,
      );

      if (status !== "pending") {
        const actor = "user-admin";
        await insertModlog.run(
          `mod-${i + 1}`,
          id,
          actor,
          "pending",
          status,
          status === "rejected" ? "Off-topic for this category." : null,
          createdAt + 3600_000,
        );
      }

      // A few discussion posts on published entries
      if (status === "published" && i % 6 === 0) {
        await insertComment.run(
          `comment-${i}-a`,
          id,
          `user-${studentIds[(i + 3) % studentIds.length]}`,
          "Thank you for posting this. Is there an update for students in the evening shift?",
          0,
          createdAt + 7200_000,
        );
        await insertComment.run(
          `comment-${i}-b`,
          id,
          "user-admin",
          "We have forwarded this to the office concerned and will post an update here once we receive a reply.",
          0,
          createdAt + 10_800_000,
        );
      }
    }

    // Demo pictures for a handful of published posts.
    const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./storage/uploads");
    for (const [i, media] of (DEMO_ATTACHMENTS).entries()) {
      const entryId = entryIdByTitle.get(media.title);
      if (!entryId) continue;
      const diskPath = path.join(uploadDir, media.file);
      if (!fs.existsSync(diskPath)) continue;
      const mime =
        MIME_BY_EXTENSION[path.extname(media.file).slice(1).toLowerCase()] ??
        "application/octet-stream";
      await uploadFile("attachments", media.file, new Uint8Array(fs.readFileSync(diskPath)), mime);
      await insertAttachment.run(
        `att-demo-${i + 1}`,
        entryId,
        media.filename,
        mime,
        fs.statSync(diskPath).size,
        media.file,
        now - (40 - i) * 3600_000,
      );
    }

    // Likes on published entries, plus a few saved posts for the demo student
    for (const [i, id] of (entryIds.slice(0, 42)).entries()) {
      const likes = (i * 5) % 7;
      for (let j = 0; j < likes; j++) {
        const student = studentIds[(i * 3 + j) % studentIds.length];
        await insertLike.run(`like-${i}-${j}`, id, `user-${student}`, now - (i + j) * 3600_000);
      }
    }

    for (const [i, entryIndex] of ([0, 4, 8]).entries()) {
      await insertSave.run(
        `save-seed-${i + 1}`,
        entryIds[entryIndex],
        studentId(DEMO_STUDENTS[0]),
        now - i * 86400_000,
      );
    }

    // Reposts: a handful from the demo student plus a spread across students
    for (const [i, entryIndex] of ([2, 6, 10, 14]).entries()) {
      await insertRepost.run(
        `repost-seed-${i + 1}`,
        entryIds[entryIndex],
        studentId(DEMO_STUDENTS[0]),
        now - i * 43200_000,
      );
    }
    for (const [i, id] of (entryIds.slice(0, 42)).entries()) {
      if (i % 4 !== 1) continue;
      const student = studentIds[(i * 5) % studentIds.length];
      await insertRepost.run(`repost-${i}`, id, `user-${student}`, now - (i + 1) * 5400_000);
    }

    // USC-organized events spread across the next 60 days.
    const EVENT_TITLES = [
      "University General Assembly",
      "Technology Showcase",
      "Community Outreach Day",
      "Wellness Week",
      "Student Leadership Seminar",
    ];
    const EVENT_PLACES = [
      "University Auditorium",
      "Technology Building, Room 501",
      "Covered Court",
      "Campus Grounds",
      "Education Building",
    ];
    for (let i = 0; i < EVENT_TITLES.length; i += 1) {
      const eventId = `event-usc-${i + 1}`;
      const startsAt = now + (8 + i * 11) * 86400_000 + 9 * 3600_000;
      await insertEvent.run(
        eventId,
        DEMO_ADMIN.id,
        EVENT_TITLES[i],
        "An activity organized by the USC for the whole Lasallian community. Open to all enrolled students. Registration is free and light refreshments will be served.",
        EVENT_PLACES[i],
        `https://example.edu/linc/events/${i + 1}`,
        startsAt,
        now - 5 * 86400_000,
      );

      // Distribute RSVPs across students
      for (let s = 0; s < 24; s++) {
        const student = studentIds[(s * 3 + i) % studentIds.length];
        const rsvpAt = now - Math.floor(rand() * 4 * 86400_000);
        await insertRsvp.run(`rsvp-${i + 1}-${student}`, eventId, `user-${student}`, rsvpAt);
        await insertReminder.run(
          `rem-${i + 1}-${student}`,
          eventId,
          `user-${student}`,
          startsAt - 86400_000,
        );
      }
    }

    // A couple of reports and a local welcome message
    await sqlite
      .prepare(
        `insert into reports (id, entry_id, reporter_id, reason, created_at, resolved_at)
         values (?, ?, ?, ?, ?, null)`,
      )
      .run(
        "report-001",
        entryIds[1],
        `user-${studentIds[4]}`,
        "This concern duplicates an entry that was already answered last week.",
        now - 2 * 86400_000,
      );

    await insertOutbox.run(
      "outbox-001",
      "system",
      "admin",
      null,
      "LINC local environment ready",
      "The database was seeded successfully. Demo accounts: usc/12345678 (USC administrator) and 34 seeded students, all using password 12345678. Arbitrary usernames and passwords are not accepted.",
      "/admin/outbox",
      now,
    );
  });
}
