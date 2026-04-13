# Session Summary — 2026-04-13f (import-fixes)

## Bugs Fixed

### BUG-FRONTLINE-06: Job import button shows no confirmation
- **Problem:** After clicking "Import Jobs" and succeeding, no visual feedback appeared.
- **Fix:** After successful import, the import button is replaced by a green tick badge showing "X jobs imported". Errors still display via a red error banner.
- **File:** `src/pages/ImportPage.jsx` (lines 519–533)

### BUG-FRONTLINE-07: Calendar View shows "0 entries parsed"
- **Root cause:** `dateCol` was hardcoded to `0` (column A = "Day + Date" text like "Mon 7 Apr"), but the actual date value is in column B (index 1). `excelDateToISO("Mon 7 Apr")` returned `null`, causing every data row to be skipped.
- **Fix:** Date column is now dynamically detected by scanning for a header cell that exactly says "date", defaulting to column B (index 1). Also added `>= 2020` year check to all branches of `excelDateToISO` (was only on the string branch).
- **File:** `src/pages/ImportPage.jsx` (lines 196–202, 15–28)

### BUG-FRONTLINE-08: Callum Ruffle → Callum Riffle
- **Problem:** Live database has "Callum Ruffle" (misspelling). Seed files already had the correct "Callum Riffle".
- **Fix:** Added `UPDATE team_members SET name = 'Callum Riffle' WHERE name = 'Callum Ruffle'` to both seed/migration files so re-running them corrects the name.
- **Files:** `supabase/002_seed_team_members.sql`, `supabase/000_full_migration.sql`
- **Live DB action required:** Run `UPDATE team_members SET name = 'Callum Riffle' WHERE name = 'Callum Ruffle';` in Supabase SQL Editor.

## Files Changed
- `src/pages/ImportPage.jsx`
- `supabase/002_seed_team_members.sql`
- `supabase/000_full_migration.sql`
- `TRACKER.md`
