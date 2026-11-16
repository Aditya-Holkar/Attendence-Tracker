-- Workforce Timesheet: schema, state machine, RLS, audit.
create extension if not exists pgcrypto;

create type public.user_role as enum ('employee', 'manager', 'admin');
create type public.session_status as enum ('working', 'on_break', 'completed');
create type public.event_type as enum ('CLOCK_IN', 'BREAK_START', 'BREAK_END', 'CLOCK_OUT');
create type public.request_status as enum ('pending', 'approved', 'rejected');

-- ---------- Tables ----------
create table public.organization_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'My Company',
  timezone text not null default 'Asia/Kolkata',
  max_break_minutes int not null default 60,
  overtime_after_minutes int not null default 480
);
insert into public.organization_settings (id) values (1);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  manager_id uuid,
  created_at timestamptz not null default now()
);

create table public.work_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null default '09:00',
  end_time time not null default '18:00',
  grace_minutes int not null default 10,
  expected_minutes int not null default 480,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role public.user_role not null default 'employee',
  department_id uuid references public.departments (id) on delete set null,
  manager_id uuid references public.profiles (id) on delete set null,
  schedule_id uuid references public.work_schedules (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.departments
  add constraint departments_manager_fk foreign key (manager_id) references public.profiles (id) on delete set null;

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null,            -- calculated in the ORGANIZATION timezone
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  status public.session_status not null default 'working',
  break_seconds int not null default 0,
  net_seconds int,
  is_adjusted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create table public.attendance_events (
  id uuid primary key,                -- generated on the device => idempotency key
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  event_type public.event_type not null,
  occurred_at timestamptz not null,   -- effective time used for calculations
  device_occurred_at timestamptz not null, -- original device time (never overwritten)
  received_at timestamptz not null default now(),
  device_id text,
  flag text                           -- future_timestamp | out_of_sequence
);

create table public.attendance_adjustments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.attendance_sessions (id) on delete set null,
  work_date date not null,
  requested_clock_in timestamptz not null,
  requested_clock_out timestamptz not null,
  reason text not null,
  status public.request_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  check (requested_clock_out > requested_clock_in)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  leave_type text not null default 'casual',
  reason text,
  status public.request_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  holiday_date date not null,
  department_id uuid references public.departments (id) on delete cascade
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Indexes ----------
create index on public.profiles (manager_id);
create index on public.profiles (department_id);
create index on public.attendance_sessions (employee_id, work_date desc);
create index on public.attendance_sessions (work_date);
create index on public.attendance_sessions (status);
create index on public.attendance_events (session_id, occurred_at);
create index on public.attendance_events (employee_id);
create index on public.attendance_events (flag) where flag is not null;
create index on public.attendance_adjustments (status);
create index on public.attendance_adjustments (employee_id);
create index on public.leave_requests (status);
create index on public.holidays (holiday_date);
create index on public.audit_logs (created_at desc);

-- ---------- Helper functions (used by RLS) ----------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active)
$$;

create function public.manages(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = emp and manager_id = auth.uid())
$$;

-- ---------- New-user profile (first user becomes admin) ----------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    case when not exists (select 1 from public.profiles) then 'admin'::public.user_role
         else 'employee'::public.user_role end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- Audit trigger ----------
create function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(), tg_op, tg_table_name, coalesce(new.id::text, old.id::text),
    jsonb_build_object(
      'old', case when tg_op <> 'INSERT' then to_jsonb(old) end,
      'new', case when tg_op <> 'DELETE' then to_jsonb(new) end
    )
  );
  return coalesce(new, old);
end $$;

create trigger audit_profiles after update on public.profiles
  for each row execute function public.audit_row();
create trigger audit_adjustments after insert or update on public.attendance_adjustments
  for each row execute function public.audit_row();
create trigger audit_sessions after update on public.attendance_sessions
  for each row when (old.is_adjusted is distinct from new.is_adjusted) execute function public.audit_row();
create trigger audit_settings after update on public.organization_settings
  for each row execute function public.audit_row();
create trigger audit_leave after update on public.leave_requests
  for each row execute function public.audit_row();

-- ---------- Attendance state machine (server-authoritative, idempotent) ----------
create function public.record_attendance_event(
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
    select max(occurred_at) into v_last from public.attendance_events where session_id = v_session.id;
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
       where session_id = v_session.id and event_type = 'BREAK_START';
      update public.attendance_sessions
         set status = 'working', updated_at = now(),
             break_seconds = break_seconds + greatest(0, extract(epoch from (v_eff - v_break_start)))::int
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

-- ---------- Correction review (no self-approval, applies change, audited) ----------
create function public.review_adjustment(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_adj public.attendance_adjustments;
  v_role public.user_role;
  v_sid uuid;
  v_break int;
begin
  select role into v_role from public.profiles where id = auth.uid() and is_active;
  select * into v_adj from public.attendance_adjustments where id = p_id for update;
  if v_adj.id is null or v_adj.status <> 'pending' then raise exception 'Request is not pending'; end if;
  if v_adj.employee_id = auth.uid() then raise exception 'You cannot review your own request'; end if;
  if not (v_role = 'admin' or (v_role = 'manager' and public.manages(v_adj.employee_id))) then
    raise exception 'Forbidden';
  end if;

  if p_approve then
    select id, break_seconds into v_sid, v_break from public.attendance_sessions
     where employee_id = v_adj.employee_id and work_date = v_adj.work_date for update;
    if v_sid is null then
      insert into public.attendance_sessions
        (employee_id, work_date, clock_in_at, clock_out_at, status, break_seconds, net_seconds, is_adjusted)
      values (v_adj.employee_id, v_adj.work_date, v_adj.requested_clock_in, v_adj.requested_clock_out,
              'completed', 0, extract(epoch from (v_adj.requested_clock_out - v_adj.requested_clock_in))::int, true);
    else
      update public.attendance_sessions
         set clock_in_at = v_adj.requested_clock_in, clock_out_at = v_adj.requested_clock_out,
             status = 'completed', is_adjusted = true, updated_at = now(),
             net_seconds = greatest(0, extract(epoch from (v_adj.requested_clock_out - v_adj.requested_clock_in))::int - v_break)
       where id = v_sid;
    end if;
  end if;

  update public.attendance_adjustments
     set status = (case when p_approve then 'approved' else 'rejected' end)::public.request_status,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
   where id = p_id;
end $$;

revoke execute on function public.record_attendance_event(uuid, public.event_type, timestamptz, text) from public, anon;
revoke execute on function public.review_adjustment(uuid, boolean, text) from public, anon;
grant execute on function public.record_attendance_event(uuid, public.event_type, timestamptz, text) to authenticated;
grant execute on function public.review_adjustment(uuid, boolean, text) to authenticated;

-- ---------- Row-level security ----------
alter table public.organization_settings enable row level security;
alter table public.departments enable row level security;
alter table public.work_schedules enable row level security;
alter table public.profiles enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_adjustments enable row level security;
alter table public.leave_requests enable row level security;
alter table public.holidays enable row level security;
alter table public.audit_logs enable row level security;

-- Reference data: everyone signed in reads, admins write.
create policy org_read on public.organization_settings for select to authenticated using (true);
create policy org_admin on public.organization_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy dept_read on public.departments for select to authenticated using (true);
create policy dept_admin on public.departments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sched_read on public.work_schedules for select to authenticated using (true);
create policy sched_admin on public.work_schedules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy hol_read on public.holidays for select to authenticated using (true);
create policy hol_admin on public.holidays for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Profiles: own row, team, or everyone for admins. Only admins edit (role changes can't be self-served).
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin() or public.manages(id));
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Sessions & events: read-only for clients; every write goes through record_attendance_event().
create policy sessions_select on public.attendance_sessions for select to authenticated
  using (employee_id = (select auth.uid()) or public.is_admin() or public.manages(employee_id));
create policy events_select on public.attendance_events for select to authenticated
  using (employee_id = (select auth.uid()) or public.is_admin() or public.manages(employee_id));

-- Corrections: employees file their own; review happens in review_adjustment().
create policy adj_select on public.attendance_adjustments for select to authenticated
  using (employee_id = (select auth.uid()) or public.is_admin() or public.manages(employee_id));
create policy adj_insert on public.attendance_adjustments for insert to authenticated
  with check (employee_id = (select auth.uid()) and status = 'pending');

-- Leave: employees file their own; admins/managers review (never their own request).
create policy leave_select on public.leave_requests for select to authenticated
  using (employee_id = (select auth.uid()) or public.is_admin() or public.manages(employee_id));
create policy leave_insert on public.leave_requests for insert to authenticated
  with check (employee_id = (select auth.uid()) and status = 'pending');
create policy leave_review on public.leave_requests for update to authenticated
  using (employee_id <> (select auth.uid()) and (public.is_admin() or public.manages(employee_id)))
  with check (employee_id <> (select auth.uid()) and (public.is_admin() or public.manages(employee_id)));

create policy audit_admin on public.audit_logs for select to authenticated using (public.is_admin());

-- Realtime for the live admin monitor (respects RLS).
alter publication supabase_realtime add table public.attendance_sessions;
