-- More categories: suggestions, inquiries, organizations, opportunities, study hub, freedom wall, memes.

insert or ignore into categories (id, slug, label, description, sort_order)
values ('cat-suggestions', 'suggestions', 'Suggestions', 'Ideas to improve the campus, services, and student life.', 6);

insert or ignore into categories (id, slug, label, description, sort_order)
values ('cat-inquiries', 'inquiries', 'Inquiries', 'Questions for university offices. Ask where to go or who to approach.', 7);

insert or ignore into categories (id, slug, label, description, sort_order)
values ('cat-organizations', 'organizations', 'Organizations', 'Clubs, org recruitment, and student organization updates.', 8);

insert or ignore into categories (id, slug, label, description, sort_order)
values ('cat-opportunities', 'opportunities', 'Opportunities', 'Internships, jobs, competitions, and scholarships beyond the campus.', 9);

insert or ignore into categories (id, slug, label, description, sort_order)
values ('cat-study-hub', 'study-hub', 'Study Hub', 'Reviewers, study groups, and shared learning resources.', 10);

insert or ignore into categories (id, slug, label, description, sort_order)
values ('cat-freedom-wall', 'freedom-wall', 'Freedom Wall', 'Say what is on your mind, confessions and shoutouts. Be kind and respectful.', 11);

insert or ignore into categories (id, slug, label, description, sort_order)
values ('cat-memes', 'memes', 'Memes', 'Campus humor. Keep it funny, keep it clean.', 12);

update categories set sort_order = 0 where slug = 'announcements';
update categories set sort_order = 1 where slug = 'concerns';
update categories set sort_order = 2 where slug = 'academic';
update categories set sort_order = 3 where slug = 'events';
update categories set sort_order = 4 where slug = 'services';
update categories set sort_order = 5 where slug = 'policies';
update categories set sort_order = 13 where slug = 'lost-found';
update categories set sort_order = 14 where slug = 'marketplace';
update categories set sort_order = 15 where slug = 'general';
