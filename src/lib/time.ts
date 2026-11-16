const pad = (n: number) => String(n).padStart(2, "0");

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function formatHM(totalSeconds: number | null | undefined) {
  if (totalSeconds == null) return "—";
  const m = Math.round(totalSeconds / 60);
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
}

/** yyyy-mm-dd for "now" in the organisation's timezone (not the browser's). */
export function todayInTz(timezone: string, date: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}

export function shiftDate(yyyyMmDd: string, days: number) {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatTime(iso: string | null | undefined, timezone: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(iso));
}

export function formatDay(yyyyMmDd: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short", day: "2-digit", month: "short", timeZone: "UTC",
  }).format(new Date(`${yyyyMmDd}T00:00:00Z`));
}
