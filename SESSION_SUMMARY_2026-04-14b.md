# Session Summary — 2026-04-14b

## BUG-FRONTLINE-15: Holiday rows now imported instead of skipped

### Root cause
The `SKIP_JOBS` set contained "holiday", "sick", etc. and the parser did `if (SKIP_JOBS.has(jobName.toLowerCase())) continue` — discarding these rows entirely.

### Fix
- Replaced `SKIP_JOBS` set with `NON_PRODUCTIVE_MAP` object mapping job names to entry types
- Added `detectNonProductive()` helper that handles both "Holiday" and "5 - Holiday" patterns (strips leading number prefix)
- Non-productive entries imported with correct `entry_type` (holiday, sick, rained_off, etc.), `gp_earned: 0`, `job_id: null`
- Holiday colour changed from purple (#9B59B6) to muted grey (#9CA3AF) in constants.js
- GP calculations already exclude non-job entries — no changes needed

### Files changed
- `src/pages/ImportPage.jsx` — parser logic
- `src/lib/constants.js` — holiday colour

---

## BUG-FRONTLINE-16: Blank job name entries importing as "Unassigned"

### Root cause
Column offset bug (BUG-17) caused numeric values from adjacent columns (hours, GP/hour) to be read as "job names". String "8" or "25.5" passed the existing blank checks.

### Fix
- Added regex check: `if (/^\d+(\.\d+)?$/.test(jobName)) continue` — skips purely numeric "job names"
- Also resolved by the column offset fix (BUG-17)

---

## BUG-FRONTLINE-17: Wrong crew data bleeding into adjacent columns

### Root cause
Sub-header column scanning was fragile:
1. Loop scanned from `startC` to `endC` looking for sub-header text matches
2. For last crew member, `endC = startC + 5` (should be +4 for 4-column blocks)
3. The `sh === 'gp'` match for gpEarnedCol could match the wrong GP column
4. Dynamic scanning could assign columns incorrectly when sub-header text varied

### Fix
- Replaced dynamic sub-header scanning with **deterministic block-width detection**: calculates gap between first two crew header columns
- Fixed offsets: `jobCol = startC`, `hoursCol = startC + 1`, `gpEarnedCol = startC + (blockWidth - 1)`
- Block width auto-detected (default 4), validated within range 3-6
- Eliminates all scanning ambiguity — every crew gets the same deterministic offsets

---

## BUG-FRONTLINE-18: Ross Sommers GP showing £0

### Root cause
Consequence of BUG-17. Ross (likely last crew member) had `endC = startC + 5`, and the sub-header scanning picked the wrong column for `gpEarnedCol`. GP Earned was read from the wrong position, returning 0.

### Fix
Resolved by BUG-17 fix. With fixed block offsets, Ross's `gpEarnedCol = startC + 3` is now correct regardless of his position in the crew list.

---

## Verification checklist
- [x] Build passes (`npm run build` — 0 errors)
- [x] `detectNonProductive` handles "Holiday", "5 - Holiday", "sick", "4 - Sick" etc.
- [x] Non-productive entries: entry_type set correctly, gp_earned=0, job_id=null
- [x] Numeric-only job names skipped (prevents false entries from adjacent columns)
- [x] Column offsets deterministic: jobCol=startC, hoursCol=startC+1, gpEarnedCol=startC+(blockWidth-1)
- [x] Block width auto-detected from crew header spacing (default 4)
- [x] Holiday colour is muted grey (#9CA3AF)
- [x] GP calculations exclude non-job entries (confirmed in calcEntryGp, calcMonthGpForecast, DashboardPage)
- [x] Unmatched jobs list filters on entry_type === 'job' (holidays don't show as unmatched)
- [x] Import payload sets entry_type correctly for non-job entries
