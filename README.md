# Tracker

Attendance and timesheets. A product by **Capslock Studio**.

Next.js 16 + React + TypeScript + Supabase + Tailwind v4 + Recharts.
Employee portal (clock, breaks, timesheets, corrections, leave) and admin/manager portal
(live status, approvals, reports, CSV export, employees, settings, audit log). Light and dark
themes are available from the toggle in the sidebar (or top-right on the sign-in page).

## Setup
1. `npm install`
2. Create a Supabase project. In the SQL editor run `supabase/migrations/0001_init.sql`, then
   `supabase/migrations/0002_resume_and_daily_updates.sql`. Both are safe to re-run.
3. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key.
4. `npm run dev`, open http://localhost:3000 and **create an account: the first account becomes the admin.**
5. As admin: Settings (timezone, schedules, departments, holidays), then Employees (roles, managers).
6. For production add your site URL to Supabase Auth redirect URLs, then deploy to Vercel.

## Deploying to Vercel

Production URL: **https://attendencetracker-gamma.vercel.app**

1. Push the repo to GitHub and import it in Vercel (framework preset: Next.js, root directory: repo root).
2. In Vercel → **Settings → Environment Variables**, add all three values for **Production** (and Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable/anon key only)
   - `NEXT_PUBLIC_SITE_URL` = `https://attendencetracker-gamma.vercel.app`
3. **Redeploy** — `NEXT_PUBLIC_*` values are baked in at build time, so adding them is not enough on its own.
4. In Supabase → **Authentication → URL Configuration**:
   - **Site URL**: `https://attendencetracker-gamma.vercel.app`
   - **Redirect URLs**: `https://attendencetracker-gamma.vercel.app/**` and `http://localhost:3000/**`
5. If the deployment is missing its env vars, every page shows a `/setup` page that lists what's missing
   instead of returning a 500.

### Email confirmation links
Sign-up sends `emailRedirectTo=<NEXT_PUBLIC_SITE_URL>/auth/callback` (falling back to the current
origin when the variable is unset), so a confirmation email created on localhost still opens the
configured deployment. Supabase only allows redirects that are listed under **Redirect URLs**;
otherwise it falls back to the **Site URL**. To skip confirmation while testing: Authentication →
Providers → Email → turn off **Confirm email**.

## How it works
- **Events, not timers.** Clock in/out and breaks are stored as timestamped events. Elapsed time is
  derived from them (`src/lib/attendance/calculations.ts`); the 1-second tick only redraws.
- **Server-authoritative state machine.** `record_attendance_event()` in Postgres validates every
  transition, is idempotent on the device-generated event id, keeps the device time, and flags
  future timestamps and out-of-sequence events.
- **Offline.** Events are saved to a local queue first, then synced when online
  (`src/lib/offline/queue.ts`, `src/hooks/use-attendance.ts`). Sign in while online first.
  This is a lightweight queue; swap in PowerSync by re-implementing `queue.ts` against its SQLite database.
- **Accidental clock-out.** The employee asks to resume today; an admin or the employee's manager
  approves it in **Approvals**. `review_resume_request()` reopens the session (back to `working`) and
  marks the mistaken `CLOCK_OUT` as `voided`, leaving the audit trail intact. Time then continues from
  the original clock-in. Only the current day can be resumed, and nobody can approve their own request.
- **Daily updates.** Employees post "what I did today" on their dashboard; the admin dashboard shows
  today's updates in a *What the team did today* card. Rows are append-only (insert + select only).
- **Security.** RLS on every table. Clients cannot write sessions/events directly, cannot change
  roles, and cannot approve their own requests. `review_adjustment()` and `review_resume_request()`
  check role and team. Timezone logic uses the organisation timezone, not the browser's.
- **Auth guard.** `src/proxy.ts` sends unauthenticated visitors to `/login?next=…` (only `/login`,
  `/setup` and `/auth/*` are public), and every page calls `requireProfile([...roles])`, which enforces
  the role on top of RLS. `/auth/callback` exchanges the code from confirmation emails, then redirects
  to the dashboard. Signing in returns the user to the page the guard sent them away from.

## Not included yet
PowerSync, geofencing/auto clock-in, multi-company (`organization_id`), PDF/Excel export (CSV only),
notifications, payroll period locking, an audit log viewer (data is recorded in `audit_logs`).
