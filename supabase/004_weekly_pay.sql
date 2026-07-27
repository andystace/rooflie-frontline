-- =============================================
-- Weekly pay tracking (invoice-day helper for Greg)
-- Run this SQL in the Supabase SQL Editor
-- =============================================

-- Free-text field for non-day-rate pay arrangements (subcontractor lump
-- sums, per-unit rates, etc.) — display only, does not feed calculations.
alter table team_members add column if not exists pay_notes text;

-- One row per team member per week: mileage + bonus are entered manually,
-- days-scheduled and base pay are derived from schedule_entries + day_rate
-- at read time (not stored, so they always reflect the live schedule).
create table if not exists weekly_pay_entries (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members(id) on delete cascade,
  week_start_date date not null,
  mileage numeric not null default 0,
  bonus numeric not null default 0,
  checked boolean not null default false,
  checked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_member_id, week_start_date)
);

create index if not exists idx_weekly_pay_entries_week on weekly_pay_entries(week_start_date);
create index if not exists idx_weekly_pay_entries_member on weekly_pay_entries(team_member_id);

alter table weekly_pay_entries enable row level security;

create policy "Allow all access to weekly_pay_entries"
  on weekly_pay_entries for all
  using (true)
  with check (true);

-- Single-row settings for pay rules that vary by business (subcontractor-heavy
-- vs employee-heavy). Starts OFF (no pay for holiday days) to match Stace
-- Roofing's current subcontractor setup — flip it on for a business whose
-- crew are employees on paid holiday.
create table if not exists pay_settings (
  id uuid primary key default gen_random_uuid(),
  pay_for_holidays boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into pay_settings (pay_for_holidays)
  select false
  where not exists (select 1 from pay_settings);

alter table pay_settings enable row level security;

create policy "Allow all access to pay_settings"
  on pay_settings for all
  using (true)
  with check (true);
