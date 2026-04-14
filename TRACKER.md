# Rooflie Frontline — Task Tracker

| ID | Task | Status |
|----|------|--------|
| RENAME-F01 | Rename all "Production Forecast" / "Rooflie Forecast" → "Rooflie Frontline" | Done |
| BUG-FORECAST-01 | Add password visibility toggle (eye icon) to sign-in screen | Done |
| BUG-FORECAST-02 | Add forgot password link to sign-in screen (Supabase reset email) | Done |
| CREW-F01 | Update crew names: Andrew Stace, Greg Stace, George Deans | Done |
| CREW-F01b | Update full crew list with surnames and correct subcontractors | Done |
| BUG-FRONTLINE-03 | Add edit and delete functions to Settings → Team Members | Done |
| ENH-FRONTLINE-01 | Bulk assign crew to a job on the schedule | Done |
| IMPORT-F01 | Spreadsheet import tool at /import (jobs + schedule from .xlsx) | Done |
| CLEAR-F01 | Clear all schedule data button on import page | Done |
| BUG-FRONTLINE-05 | Fix job import duplicate key error — use upsert with onConflict | Done |
| IMPORT-F01b | Fix Step 2 (Calendar View) import — sub-header parsing, GP column, skip non-productive | Done |
| BUG-FRONTLINE-06 | Job import button — show green tick confirmation after successful import | Done |
| BUG-FRONTLINE-07 | Calendar View "0 entries parsed" — fix date column detection (col A → col B) | Done |
| BUG-FRONTLINE-08 | Fix "Callum Ruffle" → "Callum Riffle" in seed files + live DB note | Done |
| BUG-FRONTLINE-11 | Schedule entries importing twice per person — dedup parser + import check | Done |
| BUG-FRONTLINE-12 | Job matching failing — match on job number prefix (e.g. "1078 - ...") | Done |
| BUG-FRONTLINE-13 | Month GP Forecast changes with week scroll — fetch full month data separately | Done |
| ENH-FRONTLINE-02 | Nickname field for team members — edit form, import matching on name + nickname | Done |
| IMPORT-F01b-GP | Fix GP storage, job matching (keyword fallback, name-part matching), store gp_earned from spreadsheet | Done |
| BUG-FRONTLINE-15 | Holiday rows now imported as schedule entries (entry_type: holiday) instead of skipped | Done |
| BUG-FRONTLINE-16 | Skip blank/numeric-only job name cells — prevent false "Unassigned" entries | Done |
| BUG-FRONTLINE-17 | Fix column offset bug — deterministic 4-col block width from crew header spacing | Done |
| BUG-FRONTLINE-18 | Ross Sommers GP fix — gpEarnedCol now correctly assigned via fixed block offsets | Done |
| IMPORT-F01c | Patch column matching — debug logging, word-boundary header detection, crew dedup | Done |
| IMPORT-F01d | George double entry — word-boundary matching prevents false crew column detection | Done |
| BUG-FRONTLINE-12b | Job 1109 Milestone windmill — Number() coercion for job_no comparison, strip invisible chars | Done |
| IMPORT-F01e | Multi-section crew parsing — scan all rows for crew headers, import from all sections | Done |
| IMPORT-F01f | Section 2 hours/GP offset fix — scan sub-header row for column positions, date guard on header detection | Done |
| BUG-FRONTLINE-19 | Glen Strachy Gaz Potter unmatched — normalized name matching strips special chars | Done |
| IMPORT-F01g | Section 2 sub-header detection — targeted crew-column search, expanded range, detailed logging | Done |
| ENH-FRONTLINE-04 | Full-width layout on large screens — removed max-width constraints from all pages and header | Done |
| IMPORT-F01h | Section 2 sub-header scan — search 10 rows, all crew cols, raw dump logging, next-section guard | Done |
| IMPORT-F01j | Root cause fix — min-gap filter rejects summary rows, block-width-limited column scan, GP/Hour exclusion from hours match. Verified: £71,488.64 GP total | Done |
