# Session Summary — 2026-04-14d

## IMPORT-F01e: Parser missing second row of crew blocks

### Root cause
The `parseCalendar` function only scanned rows 0–14 for crew header rows and **broke on the first match** (the `break` statement at line 300). Greg's spreadsheet has crew members split across TWO horizontal sections:
- Section 1 (row 3): George Deans, Callum Ruffle, Greg Stace, Alex Walker, Milestone, Ross Sommers, Ashley Mason
- Section 2 (further down): Ethan Swann, Josh Mee, Andrew Stace, Kaylan Bullimore

The second section was never detected, so those crew members had no schedule entries imported.

### Fix
Rewrote the header detection in `parseCalendar` to support **multiple crew sections**:

1. **Full sheet scan**: Removed the `Math.min(raw.length, 15)` limit and `break` — now scans ALL rows for any row with 2+ team member name matches
2. **Sections array**: Each detected header row becomes a `section` object with `{hdrIdx, crewCols, crewConfig, dataStart, dataEnd}`
3. **Per-section crew config**: Each section independently detects sub-headers and block width, builds its own `crewConfig` with column offsets
4. **Data row boundaries**: Each section's data rows run from `dataStart` to the next section's `hdrIdx` (or end of sheet for the last section)
5. **Merged crew display**: All sections' crew configs are merged for the UI crew mapping display
6. **Cross-section dedup**: Member ID dedup runs across all sections to prevent duplicate assignments
7. **Section-scoped parsing**: Data rows are parsed per-section using that section's crew config and column offsets

### Debug logging
- Logs total number of sections found
- Per-section: header row index, crew count, block width, data row range
- Per-section header row: all cells with match/no-match status
- Final merged crew config across all sections

---

## Files changed
- `src/pages/ImportPage.jsx` — multi-section crew header detection and parsing

## Verification checklist
- [x] Build passes (`npm run build` — 0 errors)
- [x] Header scan covers ALL rows (not just 0–14)
- [x] Multiple sections detected and stored in `sections` array
- [x] Each section has independent sub-header detection and block width
- [x] Data row boundaries: `dataStart` to next section's `hdrIdx`
- [x] Crew config merged across sections for UI display
- [x] Member ID dedup across all sections
- [x] Per-section data parsing with correct crew config
- [x] All existing features preserved (non-productive detection, GP earned, job matching, entry dedup)
- [x] Debug logging covers section count, per-section details, merged crew config
