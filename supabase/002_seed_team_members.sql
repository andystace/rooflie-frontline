-- =============================================
-- Seed team members
-- Run this AFTER 001_create_tables.sql
-- =============================================

-- Insert team members (we'll update partner IDs after all are inserted)
insert into team_members (name, role, day_rate, colour, display_order) values
  ('George',                'roofer',        250, '#2563EB', 1),
  ('Callum',                'roofer',        250, '#DC2626', 2),
  ('Greg',                  'roofer',        250, '#059669', 3),
  ('Noggy',                 'roofer',        250, '#D97706', 4),
  ('Andy',                  'roofer',        250, '#7C3AED', 5),
  ('Jack',                  'labourer',      150, '#DB2777', 6),
  ('Josh',                  'labourer',      150, '#0891B2', 7),
  ('Julian',                'subcontractor', 0,   '#65A30D', 8),
  ('Glen Strachy / Gaz Potter', 'subcontractor', 0, '#EA580C', 9),
  ('Magnetech',             'subcontractor', 0,   '#4F46E5', 10),
  ('SLJ',                   'subcontractor', 0,   '#0D9488', 11),
  ('Ronnie',                'subcontractor', 0,   '#CA8A04', 12),
  ('Ross',                  'subcontractor', 0,   '#9333EA', 13);

-- Set default partner pairings
-- George <-> Callum
update team_members
  set default_partner_id = (select id from team_members where name = 'Callum')
  where name = 'George';

update team_members
  set default_partner_id = (select id from team_members where name = 'George')
  where name = 'Callum';

-- Greg <-> Noggy
update team_members
  set default_partner_id = (select id from team_members where name = 'Noggy')
  where name = 'Greg';

update team_members
  set default_partner_id = (select id from team_members where name = 'Greg')
  where name = 'Noggy';
