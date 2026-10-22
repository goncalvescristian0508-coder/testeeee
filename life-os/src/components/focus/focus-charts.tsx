"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, ChartShell, tooltipStyle } from "@/components/charts/chart-shell";
import type { FocusDay } from "@/lib/focus";
import { fmtShortDate } from "@/lib/dates";

export function FocusBarChart({ days }: { days: FocusDay[] }) {
  const data = days.map((d) => ({ date: fmtShortDate(d.date), minutos: d.minutes, sessões: d.sessions }));
  return (
    <ChartShell height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [n === "minutos" ? `${v} min` : String(v), String(n)]} />
        <Bar dataKey="minutos" fill={CHART.primary} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartShell>
  );
}
