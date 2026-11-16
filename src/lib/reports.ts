import type { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/time";

type Sb = Awaited<ReturnType<typeof createClient>>;

export interface DailyRow {
  work_date: string;
  employee_id: string;
  name: string;
  clock_in_at: string;
  clock_out_at: string | null;
  break_seconds: number;
  net_seconds: number | null;
  status: string;
  is_adjusted: boolean;
}

export async function fetchDaily(sb: Sb, from: string, to: string, q?: string): Promise<DailyRow[]> {
  const { data } = await sb
    .from("attendance_sessions")
    .select("work_date, employee_id, clock_in_at, clock_out_at, break_seconds, net_seconds, status, is_adjusted, profiles!attendance_sessions_employee_id_fkey(full_name)")
    .gte("work_date", from).lte("work_date", to)
    .order("work_date", { ascending: false }).limit(2000);

  const rows = ((data ?? []) as any[]).map((r) => ({
    work_date: r.work_date, employee_id: r.employee_id,
    name: r.profiles?.full_name || "Unnamed",
    clock_in_at: r.clock_in_at, clock_out_at: r.clock_out_at,
    break_seconds: r.break_seconds, net_seconds: r.net_seconds,
    status: r.status, is_adjusted: r.is_adjusted,
  })) as DailyRow[];
  return q ? rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())) : rows;
}

export function aggregate(rows: DailyRow[], overtimeAfterMinutes: number) {
  const map = new Map<string, { name: string; days: number; net: number; breaks: number; overtime: number }>();
  for (const r of rows) {
    if (r.net_seconds == null) continue;
    const e = map.get(r.employee_id) ?? { name: r.name, days: 0, net: 0, breaks: 0, overtime: 0 };
    e.days += 1; e.net += r.net_seconds; e.breaks += r.break_seconds;
    e.overtime += Math.max(0, r.net_seconds - overtimeAfterMinutes * 60);
    map.set(r.employee_id, e);
  }
  return [...map.entries()].map(([id, v]) => ({ id, ...v, avgNet: v.days ? v.net / v.days : 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const hours = (s: number | null) => (s == null ? "" : (s / 3600).toFixed(2));
const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export function dailyCsv(rows: DailyRow[], tz: string) {
  const head = ["Date", "Employee", "Clock in", "Clock out", "Break (h)", "Net (h)", "Status", "Adjusted"];
  const body = rows.map((r) => [r.work_date, r.name, formatTime(r.clock_in_at, tz), formatTime(r.clock_out_at, tz),
    hours(r.break_seconds), hours(r.net_seconds), r.status, r.is_adjusted ? "yes" : "no"]);
  return [head, ...body].map((l) => l.map(esc).join(",")).join("\n");
}

export function summaryCsv(rows: ReturnType<typeof aggregate>) {
  const head = ["Employee", "Days worked", "Total net (h)", "Avg net/day (h)", "Total breaks (h)", "Overtime (h)"];
  const body = rows.map((r) => [r.name, r.days, hours(r.net), hours(r.avgNet), hours(r.breaks), hours(r.overtime)]);
  return [head, ...body].map((l) => l.map(esc).join(",")).join("\n");
}
