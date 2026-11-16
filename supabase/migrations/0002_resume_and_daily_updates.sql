-- 0002: resume after an accidental clock-out + daily work updates.
-- Run this whole file once in the Supabase SQL Editor (it is additive and safe
-- on top of 0001_init.sql). No existing data is dropped.

-- ---------------------------------------------------------------------------
-- 1) Events can be voided (an approved resume voids the accidental CLOCK_OUT)
-- ---------------------------------------------------------------------------
alter table public.attendance_events
  add column if not exists voided boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2) Resume requests: "I clocked out by mistake, let me continue today"
-- ---------------------------------------------------------------------------
create table if not exists public.resume_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  work_date date not null,
  reason text,
  status public.request_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index if not exists resume_requests_employee_idx
  on public.resume_requests (employee_id, created_at desc);
create index if not exists resume_requests_status_idx
  on public.resume_requests (status);

-- At most one open request per session.
create unique index if not exists resume_requests_one_pending
  on public.resume_requests (session_id) where status = 'pending';

alter table public.resume_requests enable row level security;

drop policy if exists resume_select on public.resume_requests;
create policy resume_select on public.resume_requests for select to authenticated
  using (employee_id = (select auth.uid()) or public.is_admin() or public.manages(employee_id));

drop policy if exists resume_insert on public.resume_requests;
create policy resume_insert on public.resume_requests for insert to authenticated
  with check (
    employee_id = (select auth.uid())
    and status = 'pending'
    -- The session must be the employee's own, for the same day.
    and exists (
      select 1 from public.attendance_sessions s
       where s.id = resume_requests.session_id
         and s.employee_id = (select auth.uid())
         and s.work_date = resume_requests.work_date
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Daily updates: "what I did today", shared with the admin/manager
-- ---------------------------------------------------------------------------
create table if not exists public.daily_updates (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists daily_updates_day_idx
  on public.daily_updates (work_date, created_at desc);
create index if not exists daily_updates_employee_idx
  on public.daily_updates (employee_id, created_at desc);

alter table public.daily_updates enable row level security;

drop policy if exists updates_select on public.daily_updates;
create policy updates_select on public.daily_updates for select to authenticated
  using (employee_id = (select auth.uid()) or public.is_admin() or public.manages(employee_id));

drop policy if exists updates_insert on public.daily_updates;
create policy updates_insert on public.daily_updates for insert to authenticated
  with check (employee_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 4) record_attendance_event: ignore voided events (same rules, new column)
-- ---------------------------------------------------------------------------
create or replace function public.record_attendance_event(
  p_event_id uuid,
  p_type public.event_type,
  p_occurred_at timestamptz,
  p_device_id text default null
) returns public.attendance_events
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_existing public.attendance_events;
  v_session public.attendance_sessions;
  v_event public.attendance_events;
  v_eff timestamptz := least(p_occurred_at, now());
  v_last timestamptz;
  v_break_start timestamptz;
  v_flag text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and is_active) then
    raise exception 'Account is inactive';
  end if;

  -- Idempotency: a retried event returns the stored row, never a duplicate.
  select * into v_existing from public.attendance_events where id = p_event_id;
  if v_existing.id is not null then
    if v_existing.employee_id <> v_uid then raise exception 'Forbidden'; end if;
    return v_existing;
  end if;

  if p_occurred_at > now() + interval '2 minutes' then v_flag := 'future_timestamp'; end if;
  select timezone into v_tz from public.organization_settings where id = 1;

  select * into v_session from public.attendance_sessions
   where employee_id = v_uid and status <> 'completed'
   order by clock_in_at desc limit 1 for update;

  if p_type = 'CLOCK_IN' then
    if v_session.id is not null then raise exception 'You are already clocked in'; end if;
    if exists (select 1 from public.attendance_sessions
                where employee_id = v_uid and work_date = (v_eff at time zone v_tz)::date) then
      raise exception 'Attendance for this date is already completed';
    end if;
    insert into public.attendance_sessions (employee_id, work_date, clock_in_at, status)
    values (v_uid, (v_eff at time zone v_tz)::date, v_eff, 'working')
    returning * into v_session;
  else
    if v_session.id is null then raise exception 'You are not clocked in'; end if;
    select max(occurred_at) into v_last from public.attendance_events
     where session_id = v_session.id and not voided;
    if v_last is not null and v_eff < v_last then
      v_flag := coalesce(v_flag, 'out_of_sequence');
      v_eff := v_last;
    end if;

    if p_type = 'BREAK_START' then
      if v_session.status <> 'working' then raise exception 'You are already on a break'; end if;
      update public.attendance_sessions set status = 'on_break', updated_at = now()
       where id = v_session.id;
    elsif p_type = 'BREAK_END' then
      if v_session.status <> 'on_break' then raise exception 'You are not on a break'; end if;
      select max(occurred_at) into v_break_start from public.attendance_events
       where session_id = v_session.id and event_type = 'BREAK_START' and not voided;
      update public.attendance_sessions
         set status = 'working', updated_at = now(),
             break_seconds = break_seconds + greatest(0, extract(epoch from (v_eff - coalesce(v_break_start, v_eff))))::int
       where id = v_session.id;
    elsif p_type = 'CLOCK_OUT' then
      if v_session.status <> 'working' then raise exception 'End your break before clocking out'; end if;
      update public.attendance_sessions
         set status = 'completed', clock_out_at = v_eff, updated_at = now(),
             net_seconds = greatest(0, extract(epoch from (v_eff - clock_in_at))::int - break_seconds)
       where id = v_session.id;
    end if;
  end if;

  insert into public.attendance_events
    (id, session_id, employee_id, event_type, occurred_at, device_occurred_at, device_id, flag)
  values (p_event_id, v_session.id, v_uid, p_type, v_eff, p_occurred_at, p_device_id, v_flag)
  returning * into v_event;
  return v_event;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Review a resume request (admin or the employee's manager, never self)
-- ---------------------------------------------------------------------------
create or replace function public.review_resume_request(
  p_id uuid,
  p_approve boolean,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_req public.resume_requests;
  v_role public.user_role;
  v_tz text;
begin
  select role into v_role from public.profiles where id = auth.uid() and is_active;
  select * into v_req from public.resume_requests where id = p_id for update;
  if v_req.id is null or v_req.status <> 'pending' then raise exception 'Request is not pending'; end if;
  if v_req.employee_id = auth.uid() then raise exception 'You cannot review your own request'; end if;
  if not (v_role = 'admin' or (v_role = 'manager' and public.manages(v_req.employee_id))) then
    raise exception 'Forbidden';
  end if;
  select timezone into v_tz from public.organization_settings where id = 1;

  if p_approve then
    -- Only the current day can be reopened; stale requests can still be rejected.
    if v_req.work_date <> (now() at time zone v_tz)::date then
      raise exception 'Only today''s attendance can be resumed';
    end if;

    -- Reopen the day. The timer continues from the original clock-in time.
    update public.attendance_sessions
       set status = 'working', clock_out_at = null, net_seconds = null, updated_at = now()
     where id = v_req.session_id and employee_id = v_req.employee_id and status = 'completed';
    if not found then raise exception 'This day is not clocked out'; end if;

    -- Keep the audit trail, but stop the clock-out from ending the day.
    update public.attendance_events
       set voided = true
     where session_id = v_req.session_id and event_type = 'CLOCK_OUT' and not voided;
  end if;

  update public.resume_requests
     set status = (case when p_approve then 'approved' else 'rejected' end)::public.request_status,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
   where id = p_id;
end $$;

revoke execute on function public.review_resume_request(uuid, boolean, text) from public, anon;
grant execute on function public.review_resume_request(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Audit + make PostgREST pick up the new columns/tables immediately
-- ---------------------------------------------------------------------------
drop trigger if exists audit_resume on public.resume_requests;
create trigger audit_resume after update on public.resume_requests
  for each row execute function public.audit_row();

notify pgrst, 'reload schema';
