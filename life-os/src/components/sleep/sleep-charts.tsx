"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, ChartShell, tooltipStyle } from "@/components/charts/chart-shell";
import type { SleepLogRow } from "@/lib/database.types";
import { fmtShortDate, timeToMinutes, toTimeStr } from "@/lib/dates";
import { sleepMetrics } from "@/lib/sleep";

export function SleepDurationChart({ logs, targetHours }: { logs: SleepLogRow[]; targetHours: number }) {
  const data = [...logs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => {
      const m = sleepMetrics(l);
      return { date: fmtShortDate(l.date), horas: +(m.asleepMin / 60).toFixed(1), cama: +(m.timeInBedMin / 60).toFixed(1), meta: targetHours };
    });
  return (
    <ChartShell>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} domain={[0, 12]} />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v} h`, n === "horas" ? "Dormindo (estimado)" : n === "cama" ? "Na cama" : String(n)]} />
        <ReferenceLine y={targetHours} stroke={CHART.warn} strokeDasharray="4 4" label={{ value: "meta", fill: CHART.text, fontSize: 10, position: "insideTopRight" }} />
        <Bar dataKey="cama" fill={CHART.muted} radius={[4, 4, 0, 0]} opacity={0.35} />
        <Bar dataKey="horas" fill={CHART.primary} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartShell>
  );
}

/** Consistência: horário de deitar/acordar por noite (minutos desde 18h para deitar / desde 0h para acordar). */
export function SleepConsistencyChart({ logs, goal, tz }: { logs: SleepLogRow[]; goal: { bedtime: string; wake_time: string }; tz: string }) {
  const toBedScale = (t: string) => ((timeToMinutes(t) - 18 * 60 + 1440) % 1440) / 60; // 18h = 0
  const data = [...logs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({ date: fmtShortDate(l.date), deitar: +toBedScale(toTimeStr(l.bed_at, tz)).toFixed(2), acordar: +(timeToMinutes(toTimeStr(l.wake_at, tz)) / 60).toFixed(2) }));
  const fmtBed = (v: number) => { const m = (18 * 60 + v * 60) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`; };
  const fmtWake = (v: number) => `${String(Math.floor(v)).padStart(2, "0")}:${String(Math.round((v % 1) * 60)).padStart(2, "0")}`;
  return (
    <ChartShell>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="bed" domain={[0, 12]} tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} tickFormatter={fmtBed} />
        <YAxis yAxisId="wake" orientation="right" domain={[0, 12]} tick={{ fontSize: 11, fill: CHART.text }} axisLine={false} tickLine={false} tickFormatter={fmtWake} />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [n === "deitar" ? fmtBed(Number(v)) : fmtWake(Number(v)), n === "deitar" ? "Deitou" : "Acordou"]} />
        <ReferenceLine yAxisId="bed" y={toBedScale(goal.bedtime)} stroke={CHART.info} strokeDasharray="4 4" />
        <ReferenceLine yAxisId="wake" y={timeToMinutes(goal.wake_time) / 60} stroke={CHART.warn} strokeDasharray="4 4" />
        <Line yAxisId="bed" type="monotone" dataKey="deitar" stroke={CHART.info} strokeWidth={2} dot={{ r: 3 }} />
        <Line yAxisId="wake" type="monotone" dataKey="acordar" stroke={CHART.warn} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ChartShell>
  );
}
