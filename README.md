# Tracker

**Attendance and timesheets, without the spreadsheet.**  
A product by **Capslock Studio**.

[Live app](https://attendencetracker-gamma.vercel.app) · [Source code](https://github.com/Aditya-Holkar/Attendence-Tracker)

## Overview

Tracker is a web-based attendance and timesheet system for small teams. Employees clock in,
take breaks and clock out from the browser; managers and admins see the team's live status,
review corrections and leave, read daily work updates, and export hours for payroll or billing.

The app is built around a simple idea: **attendance is a sequence of timestamped events, not a
running timer.** Every clock-in, break and clock-out is validated and stored by Postgres, and all
durations are derived from those timestamps. Refreshing the page, closing the tab, going offline,
or even clocking out by mistake does not lose or invent time.

It is a single-organisation deployment: one Supabase project, one company, three roles.

## Features

### Employee portal

- **Clock in / clock out** with a live timer showing net time worked, breaks excluded.
- **Breaks** — start and end a break; break time is tracked separately.
- **Today at a glance** — current status, clock-in time, break total, and time remaining against
  the assigned schedule.
- **Timesheets** — the last 60 days of sessions with in/out, breaks, net hours, and an
  *Adjusted* badge when an admin approved a correction.
- **Corrections** — request a fix for a forgotten clock-in or clock-out. A manager or admin
  reviews it; approval replaces that day's in/out times.
- **Leave** — request casual, sick, earned or unpaid leave and see upcoming holidays.
- **Resume after an accidental clock-out** — ask to reopen today's session. Once approved, the
  timer continues from the original clock-in instead of starting a new day.
- **Daily update** — post a short "what I did today" note that appears on the admin dashboard.
- **Offline tolerance** — events are queued in the browser first and synced when the connection
  returns, with visible pending and rejected states.
- **Light and dark themes**, following the system preference on first visit.

### Manager portal

Managers see **themselves plus their direct reports** — everyone whose `manager_id` points to them.

- Live overview: present, absent, on break, late, over the break allowance, and pending approvals.
- A 7-day attendance trend chart.
- **Exceptions** — missing clock-outs and suspicious event timestamps (device clock ahead,
  out of sequence).
- **Timesheets** (filter by date and name) and **reports** (filter by date), both with CSV export.
- **Approvals** for corrections, leave and resume requests.
- **What the team did today** — the daily updates feed.
- Cannot approve their own request.

### Admin portal

Admins see **the whole organisation** and get everything managers have, plus:

- **Employees** — set role, manager, department, schedule, and active/inactive status.
- **Settings** — organisation name, IANA timezone, break allowance, overtime threshold, work
  schedules, departments, and holidays.
- Promote employees to manager or admin.
- The **first account** to sign up becomes the admin automatically.
- Like managers, admins cannot approve their own requests.

### Role matrix

| Capability | Employee | Manager | Admin |
|---|:---:|:---:|:---:|
| Clock in/out, breaks, own timesheet, leave, corrections, daily updates | ✅ | ✅ | ✅ |
| See attendance and people | Self | Self + direct reports | Everyone |
| Overview, timesheets, reports, CSV export | — | Team | Organisation |
| Approve corrections, leave, resumes | — | Team | Anyone except self |
| Approve own request | — | — | — |
| Employees page (roles, managers, departments, schedules) | — | — | ✅ |
| Organisation settings, schedules, departments, holidays | — | — | ✅ |

Visibility is enforced twice: by server-side role checks in the app, and by Postgres Row Level
Security. A manager calling the API directly still cannot read another team's rows.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| UI | React 19 + TypeScript, Tailwind CSS v4 |
| Data, auth, realtime | Supabase (Postgres, Auth, Realtime, Row Level Security) |
| Charts | Recharts |
| Dates | `Intl` with IANA timezones |
| Icons | lucide-react |
| Hosting | Vercel (production branch `main`, automatic deployments) |

## How it works

### Events, not timers

`CLOCK_IN`, `BREAK_START`, `BREAK_END` and `CLOCK_OUT` are stored in `attendance_events` with
their timestamps. `src/lib/attendance/calculations.ts` derives the current status, elapsed time,
break time and net worked time from those events. The one-second UI tick only redraws; it never
owns the clock.

### Server-authoritative state machine

`record_attendance_event()` in Postgres validates every transition (`working → on_break →
working → completed`), rejects invalid actions, and updates the day's session row. Event IDs are
UUIDs generated on the device, and the function is idempotent — a retried sync returns the stored
event instead of creating a duplicate. Device time is preserved in `device_occurred_at`, while
future timestamps and out-of-sequence events are flagged for review.

### Offline event queue

Clock actions are written to `localStorage` before the UI reports success
(`src/lib/offline/queue.ts`). `useAttendance` flushes the queue on load, on reconnect, every 30
seconds, and when the tab becomes visible. Rejected events stay visible with **Retry** and
**Discard** actions. This is a deliberately small MVP queue; `queue.ts` is the seam where a full
sync engine such as PowerSync could be added.

### Resume after an accidental clock-out

The employee submits a resume request for **today** from the dashboard. An admin or the
employee's manager approves or rejects it in **Approvals**. Approval calls
`review_resume_request()`, which:

1. Sets the session back to `working` and clears `clock_out_at` / `net_seconds`.
2. Marks the mistaken `CLOCK_OUT` event as `voided`, keeping the audit trail intact.
3. Lets time continue from the original clock-in.

Only the current day can be reopened. Stale requests can still be rejected. Nobody can approve
their own request, and at most one request can be pending per session.

### Daily updates

Employees post append-only "what I did today" notes (1–2000 characters). The admin dashboard
shows today's notes in a live feed. Rows can be inserted and read by their author, an admin, or the
author's manager — there is no update or delete path.

### Timezones

The organisation's IANA timezone is the single source of truth for the work date, late
calculation, displayed times, and the "today only" resume rule. Server code does not trust the
browser's timezone.

### Security model

- **RLS on every table.** Employees read their own rows; managers read their own row and their
  direct reports'; admins read everything.
- **No direct writes to attendance.** Sessions and events are read-only to clients. Clock actions
  must go through `record_attendance_event()`.
- **Profiles are admin-writable only.** Users cannot change their own role, manager or active flag.
- **No self-approval.** `review_adjustment()`, `review_resume_request()` and the leave policy all
  reject a reviewer who is the requester.
- **Audit data.** Triggers record profile updates, correction records, session adjustments,
  settings updates, leave reviews and resume reviews in `audit_logs`. There is no audit-log viewer
  in the UI yet.
- **Auth guard.** `src/proxy.ts` redirects unauthenticated visitors to `/login?next=…` and keeps
  `/login`, `/setup` and `/auth/*` public. Every protected layout and page also calls
  `requireProfile([...roles])`.
- **No secrets in the browser.** Only the Supabase publishable/anon key is used; the service-role
  key is never part of the app.

### Theming

Colours are CSS variables with a `.dark` class on `<html>`. A tiny pre-paint script reads
`localStorage["tracker-theme"]` (or the system preference) before the first frame, so dark-mode
users never see a white flash. The toggle lives in the sidebar and on the sign-in page.

## Project structure

```
src/
  app/
    employee/          Employee portal: today, timesheets, corrections, leave
    admin/             Manager + admin portal: overview, timesheets, approvals,
                       reports, employees, settings
    auth/callback/     Exchanges the Supabase email-link code for a session
    api/reports/       CSV export (daily and summary)
    actions.ts         Server actions for all mutations
    layout.tsx         Metadata, theme bootstrap, global footer
  components/          Clock panel, sidebar, charts, theme toggle, UI primitives
  hooks/               use-attendance: live state, offline queue, sync
  lib/
    attendance/        Event maths and the client-side state machine
    offline/           localStorage event queue
    supabase/          Browser/server clients and the auth guard
    auth.ts            requireProfile role guards
    reports.ts         Daily rows, aggregation, CSV generation
    time.ts            IANA timezone helpers
supabase/migrations/
  0001_init.sql                    Schema, RLS, roles, state machine, audit
  0002_resume_and_daily_updates.sql Resume requests + daily updates
```

## Getting started

### Prerequisites

- Node.js 20.9 or later
- npm
- A [Supabase](https://supabase.com) project

### 1. Install

```bash
git clone https://github.com/Aditya-Holkar/Attendence-Tracker.git
cd Attendence-Tracker
npm install
```

### 2. Create the database

Open your Supabase project → **SQL Editor** and run the migrations **in order**:

1. `supabase/migrations/0001_init.sql` — **once, on a fresh project.** It creates types, tables,
   functions, triggers and policies, and is not idempotent.
2. `supabase/migrations/0002_resume_and_daily_updates.sql` — additive and safe to run on an
   existing database. It adds `resume_requests`, `daily_updates`, the `voided` column, and the
   updated event/review functions.

> If your project already has the `0001` schema, **do not run it again**. Apply only `0002`.

The full schema is described below.

### 3. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=https://attendencetracker-gamma.vercel.app
```

| Variable | Required | Purpose |
|---|:---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Publishable / anon key (never the service-role key) |
| `NEXT_PUBLIC_SITE_URL` | Optional | Canonical public URL used in confirmation emails; falls back to the browser origin |

If the two Supabase values are missing, the app shows a `/setup` page listing what is missing
instead of returning a 500.

### 4. Run locally

```bash
npm run dev
```

Open <http://localhost:3000> and **create an account — the first account becomes the admin.**

### 5. Finish the organisation setup

As the admin:

1. **Settings** — set the organisation name, timezone, break allowance, overtime threshold,
   work schedules, departments and holidays.
2. **Employees** — assign roles, managers, departments and schedules to people who sign up.
   Later sign-ups are employees until an admin changes their role.

## Database schema

| Group | Tables |
|---|---|
| Configuration | `organization_settings`, `departments`, `work_schedules`, `holidays` |
| People | `profiles` (linked 1:1 to `auth.users`) |
| Attendance | `attendance_sessions` (one per employee per work date), `attendance_events` |
| Requests | `attendance_adjustments`, `leave_requests`, `resume_requests` |
| Activity | `daily_updates`, `audit_logs` |

Key functions:

- `record_attendance_event(event_id, type, occurred_at, device_id)` — the attendance state
  machine. Security definer, idempotent, validates every transition.
- `review_adjustment(id, approve, note)` — applies an approved correction and marks the session
  adjusted.
- `review_resume_request(id, approve, note)` — reopens today's session and voids the mistaken
  clock-out.
- `is_admin()` / `manages(employee_id)` — RLS helpers for role and team scope.

`attendance_sessions` is also added to the `supabase_realtime` publication, which powers the live
admin overview.

## Deployment

Production: **<https://attendencetracker-gamma.vercel.app>**  
Repository: **<https://github.com/Aditya-Holkar/Attendence-Tracker>** (branch `main`)

Vercel is linked to the repository with automatic deployments enabled, so every push to `main`
ships to production.

1. Import the repository in Vercel (framework preset: **Next.js**, root directory: repository
   root).
2. In Vercel → **Settings → Environment Variables**, add all three values for **Production**
   (and **Preview** if you use preview deployments):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` = `https://attendencetracker-gamma.vercel.app`
3. **Redeploy.** `NEXT_PUBLIC_*` values are baked in at build time; adding them is not enough on
   its own.
4. In Supabase → **Authentication → URL Configuration**:
   - **Site URL**: `https://attendencetracker-gamma.vercel.app`
   - **Redirect URLs**: `https://attendencetracker-gamma.vercel.app/**` and
     `http://localhost:3000/**`
5. Apply migration `0002` if the production database has not received it yet.

### Email confirmation links

Sign-up sends `emailRedirectTo=<NEXT_PUBLIC_SITE_URL>/auth/callback` (falling back to the current
origin when the variable is unset), so a confirmation email created on localhost still opens the
configured deployment.

Supabase only allows redirects listed under **Redirect URLs**; otherwise it falls back to the
**Site URL**. Keep the default `{{ .ConfirmationURL }}` link in **Authentication → Email Templates
→ Confirm signup** — `{{ .SiteURL }}` ignores the per-request redirect.

The app handles the rest:

- `/auth/callback` exchanges the one-time code for a session and redirects to the dashboard.
- A `?code=` that lands on the site root is forwarded to `/auth/callback`.
- Expired or already-used links are sent to a clean `/login?error=link` with a readable message.
- Signing in returns the user to the page the auth guard originally blocked.

To skip email confirmation while testing: **Authentication → Providers → Email →** turn off
**Confirm email**.

### Troubleshooting sign-in links

| Symptom | Fix |
|---|---|
| The link opens `localhost:3000` | Set the Supabase **Site URL** and add the production domain to **Redirect URLs** |
| `otp_expired` / "link is invalid or has expired" | The link was used or timed out. Resend it from **Authentication → Users**, or delete the unconfirmed user and sign up again |
| The link opens the app but no session is created | Check the email template uses `{{ .ConfirmationURL }}`, not `{{ .SiteURL }}` |
| Every page shows `/setup` | The Supabase environment variables are missing; add them and redeploy |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check without emitting |

## Limitations and roadmap

Tracker intentionally stays small. Not included yet:

- Multi-company support (`organization_id`) — one deployment serves one organisation.
- Self-service password reset UI (Supabase Auth supports the flow; the app has no screen for it).
- Payroll period locking and payroll-provider integrations.
- PDF/Excel export — CSV only.
- Email or push notifications for approvals and missing clock-outs.
- Geofencing or automatic clock-in.
- An audit-log viewer (the data is recorded in `audit_logs`).
- A production-grade offline sync engine — the current queue is a localStorage MVP. Sign in while
  online first; offline actions are queued after that.

## Credits

Tracker is designed and built by **Capslock Studio**.

- Live: <https://attendencetracker-gamma.vercel.app>
- Source: <https://github.com/Aditya-Holkar/Attendence-Tracker>
