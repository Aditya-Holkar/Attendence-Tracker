import type { ReactNode } from "react";

export function Card({ title, action, children, className = "" }: {
  title?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-lg border border-line bg-white ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const tones = {
  work: "bg-work-soft text-work",
  pause: "bg-pause-soft text-pause",
  alert: "bg-alert-soft text-alert",
  neutral: "bg-slate-100 text-muted",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function statusBadge(status: string) {
  const map: Record<string, [keyof typeof tones, string]> = {
    working: ["work", "Working"], on_break: ["pause", "On break"],
    completed: ["neutral", "Completed"], not_started: ["alert", "Not started"],
    pending: ["pause", "Pending"], approved: ["work", "Approved"], rejected: ["alert", "Rejected"],
  };
  const [tone, label] = map[status] ?? ["neutral", status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="tnum mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-muted">
            {head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="[&_td]:px-3 [&_td]:py-2.5 [&_tr]:border-b [&_tr]:border-line/60">{children}</tbody>
      </table>
      {empty && <p className="px-3 py-6 text-center text-sm text-muted">{empty}</p>}
    </div>
  );
}

export const inputCls = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm";
export const btnCls = "rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-black";
export const btnGhost = "rounded-md border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      {children}
    </label>
  );
}

export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}
