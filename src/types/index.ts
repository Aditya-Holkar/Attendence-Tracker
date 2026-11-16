export type Role = "employee" | "manager" | "admin";
export type SessionStatus = "working" | "on_break" | "completed";
export type EventType = "CLOCK_IN" | "BREAK_START" | "BREAK_END" | "CLOCK_OUT";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  department_id: string | null;
  manager_id: string | null;
  schedule_id: string | null;
  is_active: boolean;
}

export interface OrgSettings {
  name: string;
  timezone: string;
  max_break_minutes: number;
  overtime_after_minutes: number;
}

export interface SessionRow {
  id: string;
  employee_id: string;
  work_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  status: SessionStatus;
  break_seconds: number;
  net_seconds: number | null;
  is_adjusted: boolean;
}

export interface ResumeRequest {
  id: string;
  employee_id: string;
  session_id: string;
  work_date: string;
  reason: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

export interface DailyUpdate {
  id: string;
  employee_id: string;
  work_date: string;
  message: string;
  created_at: string;
}
