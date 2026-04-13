-- =============================================
-- Rooflie Production Forecast — Supabase Tables
-- Run this SQL in the Supabase SQL Editor
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
-- INDEXES for performance
-- =============================================
create index if not exists idx_jobs_status on jobs(status);
create index if not exists idx_schedule_entries_date on schedule_entries(date);
create index if not exists idx_schedule_entries_team_member on schedule_entries(team_member_id);
create index if not exists idx_schedule_entries_job on schedule_entries(job_id);
create index if not exists idx_cost_entries_job on cost_entries(job_id);
create index if not exists idx_variations_job on variations(job_id);

-- =============================================
-- ROW LEVEL SECURITY — V1: all access
-- =============================================

-- Enable RLS on all tables
alter table jobs enable row level security;
alter table variations enable row level security;
alter table team_members enable row level security;
alter table schedule_entries enable row level security;
alter table cost_entries enable row level security;
alter table monthly_targets enable row level security;

-- Policy: allow everything for all users (anon + authenticated)
-- For V1 we keep it open; tighten later with auth

create policy "Allow all access to jobs"
  on jobs for all
  using (true)
  with check (true);

create policy "Allow all access to variations"
  on variations for all
  using (true)
  with check (true);

create policy "Allow all access to team_members"
  on team_members for all
  using (true)
  with check (true);

create policy "Allow all access to schedule_entries"
  on schedule_entries for all
  using (true)
  with check (true);

create policy "Allow all access to cost_entries"
  on cost_entries for all
  using (true)
  with check (true);

create policy "Allow all access to monthly_targets"
  on monthly_targets for all
  using (true)
  with check (true);
