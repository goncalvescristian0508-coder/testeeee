"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, ChartShell, tooltipStyle } from "@/components/charts/chart-shell";
import { fmtShortDate } from "@/lib/dates";

export function HabitRateChart({ data }: { data: { date: string; rate: number | null }[] }) {
  const rows = data.map((d) => ({ date: fmtShortDate(d.date), taxa: d.rate }));
  return (
    <ChartShell height={200}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs><linearGradient id="g-rate" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.primary} stopOpacity={0.4} /><stop offset="100%" stopColor={CHART.primary} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} formatter={(v) => [v == null ? "sem dados" : `${v}%`, "Hábitos"]} />
        <Area type="monotone" dataKey="taxa" stroke={CHART.primary} fill="url(#g-rate)" strokeWidth={2} connectNulls dot={false} />
      </AreaChart>
    </ChartShell>
  );
}

export function WeeklyCompareChart({ weeks }: { weeks: { label: string; habitRate: number; focusMinutes: number; tasksDone: number }[] }) {
  return (
    <ChartShell height={200}>
      <BarChart data={weeks} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="l" tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [n === "habitRate" ? `${v}%` : n === "focusMinutes" ? `${v} min` : String(v), n === "habitRate" ? "Hábitos" : n === "focusMinutes" ? "Foco" : "Tarefas"]} />
        <Bar yAxisId="l" dataKey="habitRate" fill={CHART.primary} radius={[4, 4, 0, 0]} />
        <Bar yAxisId="r" dataKey="focusMinutes" fill={CHART.info} radius={[4, 4, 0, 0]} />
        <Bar yAxisId="l" dataKey="tasksDone" fill={CHART.muted} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartShell>
  );
}

export function SleepTrendChart({ data }: { data: { date: string; hours: number | null }[] }) {
  const rows = data.map((d) => ({ date: fmtShortDate(d.date), horas: d.hours }));
  return (
    <ChartShell height={180}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis domain={[0, 12]} tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} formatter={(v) => [v == null ? "sem registro" : `${v} h`, "Sono"]} />
        <Line type="monotone" dataKey="horas" stroke={CHART.info} strokeWidth={2} dot={{ r: 2 }} connectNulls />
      </LineChart>
    </ChartShell>
  );
}
