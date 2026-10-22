"use client";

import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, ChartShell, tooltipStyle } from "@/components/charts/chart-shell";
import { APPS, entriesOf } from "@/lib/screen-time";
import type { ScreenTimeLogRow } from "@/lib/database.types";
import { dateRange, fmtShortDate } from "@/lib/dates";

const COLORS = [CHART.danger, CHART.warn, CHART.info, CHART.muted, "var(--chart-2)"];

export function ScreenTimeStackedChart({ logs, from, to, goalTotal }: { logs: ScreenTimeLogRow[]; from: string; to: string; goalTotal: number | null }) {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const data = dateRange(from, to).map((d) => {
    const l = byDate.get(d);
    const e = l ? entriesOf(l) : {};
    return { date: fmtShortDate(d), ...Object.fromEntries(APPS.map((a) => [a.label, e[a.key] ?? 0])) };
  });
  return (
    <ChartShell height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v} min`, String(n)]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {goalTotal ? <ReferenceLine y={goalTotal} stroke={CHART.danger} strokeDasharray="4 4" /> : null}
        {APPS.map((a, i) => (
          <Bar key={a.key} dataKey={a.label} stackId="a" fill={COLORS[i]} radius={i === APPS.length - 1 ? [4, 4, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ChartShell>
  );
}
