-- =============================================
-- Migration: Add nickname to team_members, gp_earned to schedule_entries
-- Run this SQL in the Supabase SQL Editor
-- =============================================

-- Nickname for team members (e.g. "Patch" for Ashley Mason)
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Store GP earned from spreadsheet import per schedule entry
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS gp_earned NUMERIC NOT NULL DEFAULT 0;
