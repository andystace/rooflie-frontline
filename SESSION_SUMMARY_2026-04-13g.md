# Session Summary — 2026-04-13g (forecast-fix)

## Bugs Fixed

### BUG-FRONTLINE-13: Month GP Forecast changes with week scroll
- **Root cause:** Summary strip calculated GP from `entries` which was filtered to the visible date range (week view). Scrolling weeks changed the entries, so the "Month GP Forecast" only showed that week's GP.
- **Fix:** Added separate `monthEntries` state with its own Supabase fetch for the full current month (start-of-month to end-of-month), independent of the visible week. Summary strip calculations now use this full-month data.
- **File:** `src/pages/SchedulePage.jsx`

### BUG-FRONTLINE-11: Schedule entries importing twice per person per day
- **Fix (parser dedup):** After parsing calendar data, deduplicate entries by `(date, team_member_id, jobName)` — handles duplicate crew columns in the spreadsheet (e.g. "Ross" appearing twice in headers).
- **Fix (import dedup):** Before inserting, fetch existing schedule entries for the date range. Build a key set from `(team_member_id, date, job_id)` and skip any entries that already exist. Status message shows how many duplicates were skipped.
- **File:** `src/pages/ImportPage.jsx`

### BUG-FRONTLINE-12: Job matching failing (red warning triangles)
- **Root cause:** Spreadsheet has entries like "1078 - Picts lane all remaining jobs" but `matchJob` only did name matching. The jobs table stores the name without the number prefix.
- **Fix:** `matchJob` now first extracts leading digits (3-5 digit number) from the job name and matches against `job.job_no`. Falls through to existing name matching if no number match found.
- **File:** `src/pages/ImportPage.jsx`

## Files Changed
- `src/pages/SchedulePage.jsx` — separate month fetch for summary strip
- `src/pages/ImportPage.jsx` — job number matching, parser dedup, import dedup
- `TRACKER.md`
