# Rooflie Frontline

## What This Is

A production scheduling and GP forecasting tool for Stace Roofing Ltd. Replaces an Excel spreadsheet (January_2026_copy_3.xlsx) that the team has outgrown.

## Who Uses It

- **Andrew** (MD) — GP forecasting, capacity planning, job profitability
- **Greg** (Site Manager) — daily scheduling, who is where tomorrow
- **Jane** (Office) — overview of upcoming work
- **Mandie** (Finance) — month-end WIP reporting

## What It Does

### 4 Core Views

1. **Schedule Board** — Google Calendar-style. People as swimlane rows, days as columns, jobs as coloured drag-and-drop blocks. Week/month/pipeline views. GP summary strip always pinned.
2. **Job List** — Searchable, sortable table of all jobs. Add/edit/view. Detail panel with variations, costs, schedule summary, profitability card.
3. **GP & Capacity Dashboard** — GP per person per week, forecast vs target, capacity gaps, job profitability league table.
4. **WIP Report** — For month-end accounts. Labour progress + actual costs (materials, scaffold, etc). One button, get the numbers.

### Key Features

- Drag-and-drop scheduling (like Google/Apple Calendar)
- Core pair prompting (George+Callum, Greg+Noggy) — suggests partner when scheduling
- Split days — two jobs on one day, stacked blocks
- Non-productive time (holiday, sick, rained off, surveys, office, training)
- Variations attach to jobs and auto-roll-up totals
- Cost tracking per job (materials, scaffold, skip, MEWP, subcontractor, etc.)
- Variable monthly GP targets and breakeven via settings screen
- Invoiced amounts tracked per job for accurate WIP
- Completed jobs preserved forever for profitability analysis
- Team members can be added/deactivated (not deleted — preserves history)
- Subcontractors get full scheduling, same swimlane rows as own team
- Month forecast GP figure always visible on schedule board

## Tech Stack

- **React + Vite + Tailwind CSS** (same as Survey and Quote modules)
- **Supabase** — backend database with Row Level Security. Shared access for all users.
- **FullCalendar** (React) — for the schedule board. Resource timeline view = people as rows, days as columns.
- **PIN auth** — same system as Survey module (Andrew, Greg, Jane + add Mandie)
- **Deploy to Netlify**

## Supabase Tables

### jobs
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| job_no | integer | simPRO job number |
| job_name | text | Client name or short description |
| status | text | pipeline / confirmed / in_progress / complete / on_hold |
| accepted_date | date | nullable |
| completed_date | date | nullable |
| sold_value | numeric | Total contract value |
| sold_gp | numeric | Gross profit from quote |
| hours_allowed | numeric | Total hours quoted |
| hours_used_previous | numeric | Hours from previous months, carried forward |
| material_budget | numeric | nullable |
| material_spent | numeric | Auto-calculated from cost_entries |
| scaffold_cost | numeric | Auto-calculated from cost_entries |
| other_costs | numeric | Auto-calculated from cost_entries |
| invoiced_to_date | numeric | Amount invoiced to client |
| notes | text | nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### variations
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| job_id | uuid | FK to jobs |
| variation_no | integer | Sequential per job |
| detail | text | Description |
| variation_value | numeric | Additional contract value |
| variation_gp | numeric | Additional GP |
| additional_hours | numeric | Extra hours |
| accepted_date | date | nullable |
| completed_date | date | nullable |
| created_at | timestamptz | |

### team_members
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| name | text | Display name |
| role | text | roofer / labourer / subcontractor / apprentice |
| default_partner_id | uuid | nullable FK to team_members |
| day_rate | numeric | For labour cost calculations |
| active | boolean | default true |
| colour | text | Hex colour for calendar |
| display_order | integer | Sort order on schedule |
| created_at | timestamptz | |

### schedule_entries
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| team_member_id | uuid | FK to team_members |
| job_id | uuid | FK to jobs (nullable for non-productive) |
| entry_type | text | job / holiday / sick / rained_off / office / surveys / unbilled / training |
| date | date | |
| hours | numeric | Default 8 |
| notes | text | nullable |
| created_at | timestamptz | |

### cost_entries
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| job_id | uuid | FK to jobs |
| cost_type | text | materials / scaffold / skip / mewp / subcontractor / travel / accommodation / other |
| description | text | |
| amount | numeric | |
| date | date | |
| supplier | text | nullable |
| po_number | text | nullable |
| created_at | timestamptz | |

### monthly_targets
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| year_month | text | e.g. "2026-03" |
| gp_target | numeric | |
| breakeven | numeric | |
| created_at | timestamptz | |

## Calculated Fields (derive in app, not stored)

- **2-Man Days Allowed** = hours_allowed ÷ 16
- **Hours Used (Current)** = SUM(schedule_entries.hours) WHERE job_id = this job
- **Hours Remaining** = hours_allowed - hours_used_previous - hours_used_current
- **GP/Hour** = sold_gp ÷ hours_allowed (including variation roll-ups)
- **GP Earned per entry** = schedule_entry.hours × job.gp_per_hour
- **Labour % Complete** = (hours_used_previous + hours_used_current) ÷ hours_allowed
- **Earned Revenue** = labour_% × sold_value
- **WIP Value** = earned_revenue - invoiced_to_date
- **Actual GP to Date** = earned_revenue - (labour_cost + material_spent + scaffold_cost + other_costs)

## Non-Productive Entry Types

| Type | Colour | GP |
|------|--------|-----|
| Holiday | Purple (#9B59B6) | £0 |
| Sick | Red (#E74C3C) | £0 |
| Rained Off | Grey (#95A5A6) | £0 |
| Office Time | Blue (#3498DB) | £0 |
| Surveys | Teal (#1ABC9C) | £0 |
| Unbilled | Dark Grey (#7F8C8D) | £0 |
| Training | Green (#27AE60) | £0 |

## Team Pairing

- When scheduling a person who has a default_partner_id, prompt: "Also schedule [partner] on the same job?"
- One tap to confirm or dismiss
- If partner has a conflict on any of the selected dates, flag it

## Schedule Board Behaviour

- **Week view**: 7 days, most detailed
- **Month view**: calendar month
- **Pipeline view**: all scheduled work from today until it runs out
- **Drag and drop**: move blocks between days and people
- **Resize**: drag edge to extend/shorten
- **Split days**: multiple stacked blocks per person per day
- **Today line**: vertical highlight
- **Weekend shading**: greyed out, still schedulable
- **Job colours**: auto-assigned, same job = same colour across all people
- **Hours overrun**: amber then red when scheduled hours > allowed hours
- **Completion**: strikethrough/fade on completed job blocks
- **Summary strip** (always visible): Month GP forecast | Target | Variance | Breakeven | Utilisation %

## Initial Data

Seed the team_members table with:
- George (roofer, paired with Callum)
- Callum (roofer, paired with George)
- Greg (roofer, paired with Noggy)
- Noggy (roofer, paired with Greg)
- Andy (roofer)
- Jack (labourer)
- Josh (labourer)
- Julian (subcontractor)
- Glen Strachy / Gaz Potter (subcontractor)
- Magnetech (subcontractor)
- SLJ (subcontractor)
- Ronnie (subcontractor)
- Ross (subcontractor)

## Build Order

1. Supabase tables + RLS policies
2. Job List view (add, edit, search, filter)
3. Schedule Board with FullCalendar resource timeline
4. Drag-and-drop scheduling with pair prompting
5. Non-productive time entries
6. Summary strip with GP calculations
7. Cost entries per job
8. Variations
9. WIP Report view
10. GP & Capacity Dashboard
11. Settings screen (monthly targets, team management)
12. CSV import for initial job load from spreadsheet
13. Deploy to Netlify

## Existing Rooflie Supabase

This project shares the same Supabase instance as the Survey module. Andrew has the credentials. All tables for this module should be prefixed or namespaced to avoid conflicts.

## Deployment

- **Netlify** — same process as Survey module
- Build: `./node_modules/.bin/vite build`
- Deploy: `npx netlify-cli deploy --prod --dir=dist`
- Or set up auto-deploy from GitHub

## Design

- Clean, minimal, no clutter
- Tailwind CSS utility classes only
- Navy (#1B3A5C) and orange (#E8731A) brand colours
- Mobile-responsive for Greg checking schedule on phone
- Large tap targets for touch devices
