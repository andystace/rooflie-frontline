-- =============================================
-- Seed team members
-- Run this AFTER 001_create_tables.sql
-- =============================================

-- EMPLOYEES (internal team)
insert into team_members (name, role, day_rate, colour, display_order) values
  ('Andrew Stace',       'roofer',        250, '#7C3AED', 1),
  ('Greg Stace',         'roofer',        250, '#059669', 2),
  ('George Deans',       'roofer',        250, '#2563EB', 3),
  ('Ethan Swann',        'roofer',        250, '#DB2777', 4),
  ('Alex Walker',        'roofer',        250, '#65A30D', 5),
  ('Kaylan Bullimore',   'roofer',        250, '#4F46E5', 6),
  ('Callum Riffle',      'roofer',        250, '#DC2626', 7),
  ('Josh Mee',           'labourer',      150, '#0891B2', 8);

-- SUBCONTRACTORS (external)
insert into team_members (name, role, day_rate, colour, display_order) values
  ('Ashley Mason',       'subcontractor', 0,   '#0D9488', 9),
  ('Ross Sommers',       'subcontractor', 0,   '#9333EA', 10),
  ('Gary Potter',        'subcontractor', 0,   '#EA580C', 11),
  ('Shaun Nolan',        'subcontractor', 0,   '#D97706', 12);

-- Fix any existing misspelling: "Callum Ruffle" → "Callum Riffle"
update team_members set name = 'Callum Riffle' where name = 'Callum Ruffle';

-- Set default partner pairings
-- George Deans <-> Callum Riffle
update team_members
  set default_partner_id = (select id from team_members where name = 'Callum Riffle')
  where name = 'George Deans';

update team_members
  set default_partner_id = (select id from team_members where name = 'George Deans')
  where name = 'Callum Riffle';

-- Greg Stace <-> Shaun Nolan
update team_members
  set default_partner_id = (select id from team_members where name = 'Shaun Nolan')
  where name = 'Greg Stace';

update team_members
  set default_partner_id = (select id from team_members where name = 'Greg Stace')
  where name = 'Shaun Nolan';
