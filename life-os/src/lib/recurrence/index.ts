/**
 * Motor de recorrência (subconjunto de RRULE) operando em datas locais
 * ('yyyy-MM-dd') para evitar deslocamentos por fuso/DST. A hora da ocorrência
 * é reaplicada no fuso do usuário em cada data gerada.
 */
import { addDaysStr, addMonthsStr, addYearsStr, dateRange, diffDays, weekdayOf, localToIso, toDateStr, toTimeStr, timeToMinutes } from "@/lib/dates";
import type { RecurrenceFreq } from "@/lib/database.types";

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval?: number;
  by_weekday?: number[] | null;
  by_monthday?: number | null;
  until?: string | null; // 'yyyy-MM-dd' inclusivo
  count?: number | null;
}

export interface RecurrenceException {
  original_date: string;
  kind: "skip" | "moved";
  new_start_at?: string | null;
  new_end_at?: string | null;
}

/** Gera as datas de ocorrência entre [from, to] (inclusive) a partir de startDate. */
export function expandRuleDates(startDate: string, rule: RecurrenceRule, from: string, to: string, hardLimit = 1000): string[] {
  const interval = Math.max(1, rule.interval ?? 1);
  const until = rule.until && rule.until < to ? rule.until : to;
  const out: string[] = [];
  let produced = 0; // conta ocorrências desde o início (para `count`)

  const push = (d: string) => {
    if (d < startDate) return;
    if (rule.count != null && produced >= rule.count) return;
    produced++;
    if (d >= from && d <= until) out.push(d);
  };

  if (rule.freq === "daily") {
    // Começa na primeira data >= from alinhada ao intervalo.
    let d = startDate;
    if (rule.count == null && from > startDate) {
      const skip = Math.floor(diffDays(from, startDate) / interval) * interval;
      d = addDaysStr(startDate, skip);
    }
    let guard = 0;
    while (d <= until && guard++ < hardLimit) {
      push(d);
      if (rule.count != null && produced >= rule.count) break;
      d = addDaysStr(d, interval);
    }
    return out;
  }

  if (rule.freq === "weekly") {
    const weekdays = rule.by_weekday && rule.by_weekday.length ? [...rule.by_weekday].sort() : [weekdayOf(startDate)];
    // Semana de referência: semana (dom-sáb) que contém startDate.
    const startWeek = addDaysStr(startDate, -weekdayOf(startDate));
    let week = startWeek;
    if (rule.count == null && from > startDate) {
      const weeksDiff = Math.floor(diffDays(from, startWeek) / 7);
      week = addDaysStr(startWeek, Math.floor(weeksDiff / interval) * interval * 7);
    }
    let guard = 0;
    while (week <= until && guard++ < hardLimit) {
      for (const wd of weekdays) {
        const d = addDaysStr(week, wd);
        if (d > until) break;
        push(d);
        if (rule.count != null && produced >= rule.count) return out;
      }
      week = addDaysStr(week, 7 * interval);
    }
    return out;
  }

  if (rule.freq === "monthly") {
    const monthday = rule.by_monthday ?? Number(startDate.slice(8, 10));
    let month = startDate.slice(0, 7) + "-01";
    let guard = 0;
    while (month <= until && guard++ < hardLimit) {
      const d = clampMonthDay(month, monthday);
      push(d);
      if (rule.count != null && produced >= rule.count) break;
      month = addMonthsStr(month, interval);
    }
    return out;
  }

  if (rule.freq === "yearly") {
    let d = startDate;
    let guard = 0;
    while (d <= until && guard++ < hardLimit) {
      push(d);
      if (rule.count != null && produced >= rule.count) break;
      d = addYearsStr(d, interval);
    }
    return out;
  }

  return out;
}

/** Garante dia válido no mês (ex.: dia 31 em fevereiro vira o último dia). */
function clampMonthDay(monthStart: string, day: number) {
  const nextMonth = addMonthsStr(monthStart, 1);
  const lastDay = Number(addDaysStr(nextMonth, -1).slice(8, 10));
  const d = Math.min(Math.max(1, day), lastDay);
  return monthStart.slice(0, 8) + String(d).padStart(2, "0");
}

export interface OccurrenceSource {
  id: string;
  start_at: string; // ISO
  end_at: string; // ISO
  rule?: RecurrenceRule | null;
  exceptions?: RecurrenceException[];
}

export interface Occurrence<T extends OccurrenceSource = OccurrenceSource> {
  source: T;
  /** chave estável: `${id}:${originalDate}` */
  key: string;
  originalDate: string;
  start_at: string;
  end_at: string;
  moved: boolean;
  isRecurring: boolean;
}

/**
 * Expande eventos (recorrentes ou não) para ocorrências concretas no intervalo
 * de datas locais [from, to], aplicando exceções (pular/remarcar).
 */
export function expandOccurrences<T extends OccurrenceSource>(items: T[], from: string, to: string, tz: string): Occurrence<T>[] {
  const out: Occurrence<T>[] = [];
  for (const item of items) {
    const startDate = toDateStr(item.start_at, tz);
    const startTime = toTimeStr(item.start_at, tz);
    const durationMs = new Date(item.end_at).getTime() - new Date(item.start_at).getTime();
    const exceptions = new Map((item.exceptions ?? []).map((e) => [e.original_date, e]));

    const emit = (originalDate: string, isRecurring: boolean) => {
      const ex = exceptions.get(originalDate);
      if (ex?.kind === "skip") return;
      let start = isRecurring ? localToIso(originalDate, startTime, tz) : item.start_at;
      let end = new Date(new Date(start).getTime() + durationMs).toISOString();
      let moved = false;
      if (ex?.kind === "moved" && ex.new_start_at) {
        start = ex.new_start_at;
        end = ex.new_end_at ?? new Date(new Date(start).getTime() + durationMs).toISOString();
        moved = true;
      }
      out.push({ source: item, key: `${item.id}:${originalDate}`, originalDate, start_at: start, end_at: end, moved, isRecurring });
    };

    if (!item.rule) {
      if (startDate >= from && startDate <= to) emit(startDate, false);
      continue;
    }
    for (const d of expandRuleDates(startDate, item.rule, from, to)) emit(d, true);
  }

  // Ocorrências remarcadas podem cair fora do intervalo original; filtramos pela data real.
  return out
    .filter((o) => {
      const d = toDateStr(o.start_at, tz);
      return d >= from && d <= to;
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
}

/** Próxima ocorrência a partir de um instante. */
export function nextOccurrence<T extends OccurrenceSource>(items: T[], fromIso: string, tz: string, horizonDays = 60) {
  const from = toDateStr(fromIso, tz);
  const to = addDaysStr(from, horizonDays);
  const occ = expandOccurrences(items, from, to, tz);
  return occ.find((o) => o.end_at >= fromIso) ?? null;
}

/** Descreve a regra em português. */
export function describeRule(rule: RecurrenceRule | null | undefined): string {
  if (!rule) return "Não se repete";
  const n = rule.interval ?? 1;
  const labels = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  let base: string;
  switch (rule.freq) {
    case "daily":
      base = n === 1 ? "Todo dia" : `A cada ${n} dias`;
      break;
    case "weekly": {
      const days = (rule.by_weekday ?? []).map((d) => labels[d]).join(", ");
      base = (n === 1 ? "Toda semana" : `A cada ${n} semanas`) + (days ? ` (${days})` : "");
      break;
    }
    case "monthly":
      base = (n === 1 ? "Todo mês" : `A cada ${n} meses`) + (rule.by_monthday ? ` no dia ${rule.by_monthday}` : "");
      break;
    case "yearly":
      base = n === 1 ? "Todo ano" : `A cada ${n} anos`;
      break;
  }
  if (rule.until) base += ` até ${rule.until.split("-").reverse().join("/")}`;
  if (rule.count) base += `, ${rule.count}x`;
  return base;
}

/** Ordena ocorrências dentro de um dia pela hora local. */
export function sortByLocalTime<T extends { start_at: string }>(list: T[], tz: string) {
  return [...list].sort((a, b) => timeToMinutes(toTimeStr(a.start_at, tz)) - timeToMinutes(toTimeStr(b.start_at, tz)));
}

export { dateRange };
