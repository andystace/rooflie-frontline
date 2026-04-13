# Session Summary — 2026-04-13

## Changes Made

### RENAME-F01: App rename
- Replaced all "Rooflie Forecast" / "Production Forecast" with "Rooflie Frontline"
- Files changed: `index.html`, `src/App.jsx`, `src/pages/LoginPage.jsx`, `supabase/000_full_migration.sql`, `supabase/001_create_tables.sql`
- Renamed `Production_Forecast_README.md` → `Rooflie_Frontline_README.md`

### BUG-FORECAST-01: Password visibility toggle
- Added eye/eye-off icon toggle to password field on sign-in screen
- Uses `lucide-react` Eye/EyeOff icons
- File changed: `src/pages/LoginPage.jsx`

### BUG-FORECAST-02: Forgot password link
- Added "Forgot password?" link below sign-in button
- Triggers `supabase.auth.resetPasswordForEmail()` via new `resetPassword` function in `useAuth`
- Validates email is entered before sending
- Shows green success message on send
- Files changed: `src/pages/LoginPage.jsx`, `src/hooks/useAuth.js`

### CREW-F01: Crew member names
- George → George Deans
- Greg → Greg Stace
- Andy → Andrew Stace
- Noggy and Callum remain unchanged
- Updated partner pairing references accordingly
- Files changed: `supabase/002_seed_team_members.sql`, `supabase/000_full_migration.sql`

## Build Status
- Production build: passing
