-- Sample data for local development only:  npm run seed:local
-- Fictional companies and people, so you can see the dashboard, wall and widgets populated.

DELETE FROM testimonials WHERE space_id IN ('demo_northwind', 'demo_pocketbook');
DELETE FROM spaces WHERE id IN ('demo_northwind', 'demo_pocketbook');

INSERT INTO spaces (id, slug, name, logo_key, accent_color, headline, prompt, thank_you,
                    collect_photo, is_accepting, show_branding, created_at, updated_at)
VALUES
  ('demo_northwind', 'northwind', 'Northwind Analytics', NULL, '#2563eb', '', '', '', 1, 1, 1,
   CAST(strftime('%s', 'now', '-30 days') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  ('demo_pocketbook', 'pocketbook', 'Pocketbook', NULL, '#171717', '', '', '', 1, 1, 1,
   CAST(strftime('%s', 'now', '-12 days') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000);

INSERT INTO testimonials (id, space_id, status, rating, body, author_name, author_role, photo_key, featured, created_at, reviewed_at)
VALUES
  ('demo_t01', 'demo_northwind', 'approved', 5,
   'We replaced three dashboards and a weekly spreadsheet ritual with Northwind. Our Monday metrics meeting went from an hour to fifteen minutes.',
   'Maya Okafor', 'Head of Growth at Brightloop', NULL, 1,
   CAST(strftime('%s', 'now', '-21 days') AS INTEGER) * 1000, CAST(strftime('%s', 'now', '-20 days') AS INTEGER) * 1000),
  ('demo_t02', 'demo_northwind', 'approved', 5,
   'Setup took one afternoon. The funnel view alone paid for the year.',
   'Daniel Reyes', 'Founder, Tidepool', NULL, 0,
   CAST(strftime('%s', 'now', '-18 days') AS INTEGER) * 1000, CAST(strftime('%s', 'now', '-17 days') AS INTEGER) * 1000),
  ('demo_t03', 'demo_northwind', 'approved', 4,
   'Genuinely calm software. It does a handful of things very well and stays out of the way. I would love a few more export options, but support answered my question in under an hour.',
   'Priya Natarajan', 'Product Manager at Fieldnote', NULL, 0,
   CAST(strftime('%s', 'now', '-15 days') AS INTEGER) * 1000, CAST(strftime('%s', 'now', '-14 days') AS INTEGER) * 1000),
  ('demo_t04', 'demo_northwind', 'approved', 5,
   'Our investors asked how we got such clean retention charts. The honest answer: we stopped building them ourselves.',
   'Tom Lindqvist', 'CEO at Harbor & Co', NULL, 0,
   CAST(strftime('%s', 'now', '-12 days') AS INTEGER) * 1000, CAST(strftime('%s', 'now', '-11 days') AS INTEGER) * 1000),
  ('demo_t05', 'demo_northwind', 'approved', 5,
   'I am not a data person.
Northwind made me feel like one.',
   'Aisha Bello', 'Indie maker', NULL, 0,
   CAST(strftime('%s', 'now', '-9 days') AS INTEGER) * 1000, CAST(strftime('%s', 'now', '-8 days') AS INTEGER) * 1000),
  ('demo_t06', 'demo_northwind', 'approved', 5,
   'The weekly digest email is the only report my whole team actually reads.',
   'Sam Whitfield', 'COO, Larkspur Labs', NULL, 0,
   CAST(strftime('%s', 'now', '-6 days') AS INTEGER) * 1000, CAST(strftime('%s', 'now', '-5 days') AS INTEGER) * 1000),
  ('demo_t07', 'demo_northwind', 'approved', 4,
   'Fast, focused, and priced like the team actually wants small companies to use it.',
   NULL, 'Bootstrapped SaaS founder', NULL, 0,
   CAST(strftime('%s', 'now', '-4 days') AS INTEGER) * 1000, CAST(strftime('%s', 'now', '-3 days') AS INTEGER) * 1000),
  ('demo_t08', 'demo_northwind', 'pending', 5,
   'Switched from a much bigger tool last month. Everything I needed was there on day one, and nothing I didn''t.',
   'Lena Fischer', 'Marketing lead at Copperleaf', NULL, 0,
   CAST(strftime('%s', 'now', '-5 hours') AS INTEGER) * 1000, NULL),
  ('demo_t09', 'demo_northwind', 'pending', 4,
   'Really solid. The cohort charts are my favourite part — would love Slack alerts next!',
   'Kenji Watanabe', 'Data analyst', NULL, 0,
   CAST(strftime('%s', 'now', '-2 days') AS INTEGER) * 1000, NULL),
  ('demo_t10', 'demo_northwind', 'rejected', 2,
   'test test',
   'asdf', NULL, NULL, 0,
   CAST(strftime('%s', 'now', '-10 days') AS INTEGER) * 1000, CAST(strftime('%s', 'now', '-10 days') AS INTEGER) * 1000),
  ('demo_t11', 'demo_pocketbook', 'pending', 5,
   'Finally a budgeting app that doesn''t make me feel guilty. Pocketbook is the first one I have kept using past February.',
   'Chloe Martin', 'Freelance designer', NULL, 0,
   CAST(strftime('%s', 'now', '-1 days') AS INTEGER) * 1000, NULL),
  ('demo_t12', 'demo_pocketbook', 'approved', 5,
   'Simple, private, and beautifully made.',
   'Omar Haddad', 'Teacher', NULL, 1,
   CAST(strftime('%s', 'now', '-7 days') AS INTEGER) * 1000, CAST(strftime('%s', 'now', '-6 days') AS INTEGER) * 1000);
