/**
 * Cálculos de sono. Todos os dados são informados manualmente pelo usuário;
 * não há monitoramento automático.
 */
import { minutesBetween, timeToMinutes, toTimeStr } from "@/lib/dates";
import type { SleepLogRow } from "@/lib/database.types";

export type SleepLogLike = Pick<SleepLogRow, "bed_at" | "asleep_at" | "wake_at" | "date" | "quality">;

export interface SleepMetrics {
  timeInBedMin: number;
  asleepMin: number; // tempo estimado dormindo (se não houver asleep_at, = tempo na cama)
  latencyMin: number | null; // tempo para adormecer
  hasAsleepData: boolean;
}

export function sleepMetrics(log: SleepLogLike): SleepMetrics {
  const timeInBed = Math.max(0, minutesBetween(log.bed_at, log.wake_at));
  if (log.asleep_at && new Date(log.asleep_at) >= new Date(log.bed_at) && new Date(log.asleep_at) <= new Date(log.wake_at)) {
    const asleep = minutesBetween(log.asleep_at, log.wake_at);
    return { timeInBedMin: timeInBed, asleepMin: asleep, latencyMin: timeInBed - asleep, hasAsleepData: true };
  }
  return { timeInBedMin: timeInBed, asleepMin: timeInBed, latencyMin: null, hasAsleepData: false };
}

/** Diferença circular (em minutos) entre dois horários 'HH:mm'. */
export function circularDiffMinutes(a: string, b: string) {
  const d = Math.abs(timeToMinutes(a) - timeToMinutes(b)) % 1440;
  return Math.min(d, 1440 - d);
}

/** Desvio médio (min) dos horários de deitar/acordar em relação à meta. */
export function consistency(logs: SleepLogLike[], goal: { bedtime: string; wake_time: string }, tz: string) {
  if (!logs.length) return { bedDeviation: null, wakeDeviation: null };
  const bed = logs.map((l) => circularDiffMinutes(toTimeStr(l.bed_at, tz), goal.bedtime));
  const wake = logs.map((l) => circularDiffMinutes(toTimeStr(l.wake_at, tz), goal.wake_time));
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  return { bedDeviation: avg(bed), wakeDeviation: avg(wake) };
}

export function averageSleep(logs: SleepLogLike[]) {
  if (!logs.length) return null;
  return logs.reduce((a, l) => a + sleepMetrics(l).asleepMin, 0) / logs.length;
}

export function goalMetCount(logs: SleepLogLike[], targetHours: number) {
  return logs.filter((l) => sleepMetrics(l).asleepMin >= targetHours * 60).length;
}

/** Sugere o horário de começar a desacelerar. */
export function windDownTime(bedtime: string, minutes: number) {
  const m = ((timeToMinutes(bedtime) - minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
