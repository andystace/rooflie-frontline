-- =============================================
-- Rooflie Frontline — FULL MIGRATION
-- Paste this entire script into Supabase SQL Editor and click Run
-- =============================================

-- 1. JOBS
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  job_no integer,
  job_name text not null,
  status text not null default 'pipeline'
    check (status in ('pipeline', 'confirmed', 'in_progress', 'complete', 'on_hold')),
  accepted_date date,
  completed_date date,
  sold_value numeric not null default 0,
  sold_gp numeric not null default 0,
  hours_allowed numeric not null default 0,
  hours_used_previous numeric not null default 0,
  material_budget numeric,
  material_spent numeric not null default 0,
  scaffold_cost numeric not null default 0,
  other_costs numeric not null default 0,
  invoiced_to_date numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. VARIATIONS
create table if not exists variations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  variation_no integer not null,
  detail text not null,
  variation_value numeric not null default 0,
  variation_gp numeric not null default 0,
  additional_hours numeric not null default 0,
  accepted_date date,
  completed_date date,
  created_at timestamptz not null default now()
);

-- 3. TEAM MEMBERS
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'roofer'
    check (role in ('roofer', 'labourer', 'subcontractor', 'apprentice')),
  default_partner_id uuid references team_members(id),
  day_rate numeric not null default 0,
  active boolean not null default true,
  colour text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 4. SCHEDULE ENTRIES
create table if not exists schedule_entries (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  entry_type text not null default 'job'
    check (entry_type in ('job', 'holiday', 'sick', 'rained_off', 'office', 'surveys', 'unbilled', 'training')),
  date date not null,
  hours numeric not null default 8,
  notes text,
  created_at timestamptz not null default now()
);

-- 5. COST ENTRIES
create table if not exists cost_entries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  cost_type text not null
    check (cost_type in ('materials', 'scaffold', 'skip', 'mewp', 'subcontractor', 'travel', 'accommodation', 'other')),
  description text not null,
  amount numeric not null default 0,
  date date not null,
  supplier text,
  po_number text,
  created_at timestamptz not null default now()
);

-- 6. MONTHLY TARGETS
create table if not exists monthly_targets (
  id uuid primary key default gen_random_uuid(),
  year_month text not null unique,
  gp_target numeric not null default 0,
  breakeven numeric not null default 0,
  created_at timestamptz not null default now()
);

-- =============================================
-- INDEXES
-- =============================================
create index if not exists idx_jobs_status on jobs(status);
create index if not exists idx_schedule_entries_date on schedule_entries(date);
create index if not exists idx_schedule_entries_team_member on schedule_entries(team_member_id);
create index if not exists idx_schedule_entries_job on schedule_entries(job_id);
create index if not exists idx_cost_entries_job on cost_entries(job_id);
create index if not exists idx_variations_job on variations(job_id);

-- =============================================
-- ROW LEVEL SECURITY — V1: open access
-- =============================================
alter table jobs enable row level security;
alter table variations enable row level security;
alter table team_members enable row level security;
alter table schedule_entries enable row level security;
alter table cost_entries enable row level security;
alter table monthly_targets enable row level security;

create policy "Allow all access to jobs"
  on jobs for all using (true) with check (true);

create policy "Allow all access to variations"
  on variations for all using (true) with check (true);

create policy "Allow all access to team_members"
  on team_members for all using (true) with check (true);

create policy "Allow all access to schedule_entries"
  on schedule_entries for all using (true) with check (true);

create policy "Allow all access to cost_entries"
  on cost_entries for all using (true) with check (true);

create policy "Allow all access to monthly_targets"
  on monthly_targets for all using (true) with check (true);

-- =============================================
-- SEED TEAM MEMBERS
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

-- Set partner pairings: George Deans <-> Callum Riffle
update team_members
  set default_partner_id = (select id from team_members where name = 'Callum Riffle')
  where name = 'George Deans';
update team_members
  set default_partner_id = (select id from team_members where name = 'George Deans')
  where name = 'Callum Riffle';

-- Set partner pairings: Greg Stace <-> Shaun Nolan
update team_members
  set default_partner_id = (select id from team_members where name = 'Shaun Nolan')
  where name = 'Greg Stace';
update team_members
  set default_partner_id = (select id from team_members where name = 'Greg Stace')
  where name = 'Shaun Nolan';
