# Workforce Timesheet

Next.js 16 + React + TypeScript + Supabase + Tailwind v4 + Recharts.
Employee portal (clock, breaks, timesheets, corrections, leave) and admin/manager portal
(live status, approvals, reports, CSV export, employees, settings, audit log).

## Setup
1. `npm install`
2. Create a Supabase project. In the SQL editor run `supabase/migrations/0001_init.sql`.
3. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key.
4. `npm run dev`, open http://localhost:3000 and **create an account: the first account becomes the admin.**
5. As admin: Settings (timezone, schedules, departments, holidays), then Employees (roles, managers).
6. For production add your site URL to Supabase Auth redirect URLs, then deploy to Vercel.

## How it works
- **Events, not timers.** Clock in/out and breaks are stored as timestamped events. Elapsed time is
  derived from them (`src/lib/attendance/calculations.ts`); the 1-second tick only redraws.
- **Server-authoritative state machine.** `record_attendance_event()` in Postgres validates every
  transition, is idempotent on the device-generated event id, keeps the device time, and flags
  future timestamps and out-of-sequence events.
- **Offline.** Events are saved to a local queue first, then synced when online
  (`src/lib/offline/queue.ts`, `src/hooks/use-attendance.ts`). Sign in while online first.
  This is a lightweight queue; swap in PowerSync by re-implementing `queue.ts` against its SQLite database.
- **Security.** RLS on every table. Clients cannot write sessions/events directly, cannot change
  roles, and cannot approve their own requests. `review_adjustment()` checks role and team.
  Timezone logic uses the organisation timezone, not the browser's.

## Not included yet
PowerSync, geofencing/auto clock-in, multi-company (`organization_id`), PDF/Excel export (CSV only),
notifications, payroll period locking, an audit log viewer (data is recorded in `audit_logs`).
