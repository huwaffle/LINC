update categories set sort_order = 8 where id = 'cat-general';

insert or ignore into categories (id, slug, label, description, sort_order)
values (
  'cat-marketplace',
  'marketplace',
  'Marketplace',
  'Buy, sell, lend, or look for items within the Lasallian community.',
  7
);
