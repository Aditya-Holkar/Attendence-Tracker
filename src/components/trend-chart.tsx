"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TrendChart({ data }: { data: { day: string; present: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke="#d9dee3" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip cursor={{ fill: "#eef1f0" }} />
          <Bar dataKey="present" name="Present" fill="#0f766e" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
