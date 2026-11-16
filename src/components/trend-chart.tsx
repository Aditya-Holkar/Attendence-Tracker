"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TrendChart({ data }: { data: { day: string; present: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} tick={{ fill: "var(--muted)" }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} tick={{ fill: "var(--muted)" }} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              color: "var(--ink)",
            }}
            itemStyle={{ color: "var(--ink)" }}
          />
          <Bar dataKey="present" name="Present" fill="var(--work)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
