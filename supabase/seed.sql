-- Reference data installed by `supabase db reset`.
-- Demo accounts, posts, events and media are created by `npm run db:reset`,
-- because their scrypt password hashes and timestamps are generated at runtime.
-- There is no council reference data: the app has one USC administrator and students.

insert into categories (id, slug, label, description, sort_order) values
  ('cat-announcements', 'announcements', 'Announcements', 'Official notices from the university.', 0),
  ('cat-concerns', 'concerns', 'Concerns', 'Issues raised by students about services, facilities, and policies.', 1),
  ('cat-academic', 'academic', 'Academic', 'Enrollment, subjects, grades, and academic support.', 2),
  ('cat-events', 'events', 'Events', 'University activities, seminars, and campus-wide programs.', 3),
  ('cat-services', 'services', 'Services', 'Guidance, health, library, and student welfare services.', 4),
  ('cat-policies', 'policies', 'Policies', 'Clarifications on university rules and implementing guidelines.', 5),
  ('cat-suggestions', 'suggestions', 'Suggestions', 'Ideas to improve the campus, services, and student life.', 6),
  ('cat-inquiries', 'inquiries', 'Inquiries', 'Questions for university offices. Ask where to go or who to approach.', 7),
  ('cat-organizations', 'organizations', 'Organizations', 'Clubs, org recruitment, and student organization updates.', 8),
  ('cat-opportunities', 'opportunities', 'Opportunities', 'Internships, jobs, competitions, and scholarships beyond the campus.', 9),
  ('cat-study-hub', 'study-hub', 'Study Hub', 'Reviewers, study groups, and shared learning resources.', 10),
  ('cat-freedom-wall', 'freedom-wall', 'Freedom Wall', 'Say what is on your mind, confessions and shoutouts. Be kind and respectful.', 11),
  ('cat-memes', 'memes', 'Memes', 'Campus humor. Keep it funny, keep it clean.', 12),
  ('cat-lost-found', 'lost-found', 'Lost & Found', 'Report and recover misplaced belongings within campus.', 13),
  ('cat-marketplace', 'marketplace', 'Marketplace', 'Buy, sell, lend, or look for items within the Lasallian community.', 14),
  ('cat-general', 'general', 'General', 'Anything else the Lasallian community should know.', 15)
on conflict (id) do nothing;
