# Session Summary — 2026-04-13b

## Task: CREW-F01b — Update team members (full crew list)

### What changed

Updated the Supabase seed files (`002_seed_team_members.sql` and `000_full_migration.sql`) to reflect the correct crew roster.

**Removed** (no longer on team):
- Jack (labourer)
- Julian, Magnetech, SLJ, Ronnie (subcontractors)

**Renamed** (added surnames / corrected names):
- Callum → Callum Riffle
- Josh → Josh Mee
- Noggy → Shaun Nolan
- Glen Strachy / Gaz Potter → Gary Potter
- Ross → Ross Sommers

**Added** (new team members):
- Ethan Swann (roofer)
- Alex Walker (roofer)
- Kaylan Bullimore (roofer)
- Ashley Mason (subcontractor)

### Final crew list

**Employees (internal):**
1. Andrew Stace — roofer
2. Greg Stace — roofer
3. George Deans — roofer
4. Ethan Swann — roofer
5. Alex Walker — roofer
6. Kaylan Bullimore — roofer
7. Callum Riffle — roofer
8. Josh Mee — labourer

**Subcontractors (external):**
9. Ashley Mason
10. Ross Sommers
11. Gary Potter
12. Shaun Nolan

### Partner pairings preserved
- George Deans ↔ Callum Riffle
- Greg Stace ↔ Shaun Nolan

### React components
No hardcoded names found — all team data is fetched from Supabase at runtime. No changes needed in `.tsx`/`.jsx` files.

### Files modified
- `supabase/002_seed_team_members.sql`
- `supabase/000_full_migration.sql`
- `TRACKER.md`

### Note
The seed files define the initial data for fresh Supabase setups. For the live database, crew changes should be made via the Settings page in the app (which writes directly to Supabase).
