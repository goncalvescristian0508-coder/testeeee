/**
 * Utilitários de data/hora com fuso horário explícito.
 * Convenção: "dateStr" = 'yyyy-MM-dd' no fuso do usuário; "iso" = timestamptz em UTC.
 */
import { addDays, addMonths, addYears, differenceInCalendarDays, format, getDay, parse, startOfWeek, endOfWeek, eachDayOfInterval, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const DEFAULT_TZ = "America/Sao_Paulo";

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export const WEEKDAY_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

/** Data de hoje ('yyyy-MM-dd') no fuso informado. */
export function todayStr(tz = DEFAULT_TZ, now: Date = new Date()) {
  return formatInTimeZone(now, tz, "yyyy-MM-dd");
}

/** Hora atual ('HH:mm') no fuso informado. */
export function nowTimeStr(tz = DEFAULT_TZ, now: Date = new Date()) {
  return formatInTimeZone(now, tz, "HH:mm");
}

/** Converte um instante UTC para a data local ('yyyy-MM-dd'). */
export function toDateStr(iso: string | Date, tz = DEFAULT_TZ) {
  return formatInTimeZone(typeof iso === "string" ? new Date(iso) : iso, tz, "yyyy-MM-dd");
}

/** Converte um instante UTC para 'HH:mm' local. */
export function toTimeStr(iso: string | Date, tz = DEFAULT_TZ) {
  return formatInTimeZone(typeof iso === "string" ? new Date(iso) : iso, tz, "HH:mm");
}

/** Combina data + hora locais em um instante UTC (ISO). */
export function localToUtc(dateStr: string, timeStr: string, tz = DEFAULT_TZ): Date {
  return fromZonedTime(`${dateStr}T${normalizeTime(timeStr)}:00`, tz);
}

export function localToIso(dateStr: string, timeStr: string, tz = DEFAULT_TZ) {
  return localToUtc(dateStr, timeStr, tz).toISOString();
}

/** 'HH:mm:ss' | 'HH:mm' -> 'HH:mm' */
export function normalizeTime(t: string) {
  return t.slice(0, 5);
}

export function parseDateStr(dateStr: string): Date {
  // Date "naive" (meio-dia local do servidor evita problemas de DST ao somar dias).
  const d = parse(dateStr, "yyyy-MM-dd", new Date());
  d.setHours(12, 0, 0, 0);
  return d;
}

export function isValidDateStr(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parse(s, "yyyy-MM-dd", new Date()));
}

export function fmtDateStr(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function addDaysStr(dateStr: string, n: number) {
  return fmtDateStr(addDays(parseDateStr(dateStr), n));
}

export function addMonthsStr(dateStr: string, n: number) {
  return fmtDateStr(addMonths(parseDateStr(dateStr), n));
}

export function addYearsStr(dateStr: string, n: number) {
  return fmtDateStr(addYears(parseDateStr(dateStr), n));
}

export function diffDays(a: string, b: string) {
  return differenceInCalendarDays(parseDateStr(a), parseDateStr(b));
}

/** 0 = domingo … 6 = sábado */
export function weekdayOf(dateStr: string) {
  return getDay(parseDateStr(dateStr));
}

export function startOfWeekStr(dateStr: string, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1) {
  return fmtDateStr(startOfWeek(parseDateStr(dateStr), { weekStartsOn }));
}

export function endOfWeekStr(dateStr: string, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1) {
  return fmtDateStr(endOfWeek(parseDateStr(dateStr), { weekStartsOn }));
}

export function startOfMonthStr(dateStr: string) {
  return dateStr.slice(0, 7) + "-01";
}

export function endOfMonthStr(dateStr: string) {
  return fmtDateStr(addDays(parseDateStr(addMonthsStr(startOfMonthStr(dateStr), 1)), -1));
}

/** Lista inclusiva de datas 'yyyy-MM-dd'. */
export function dateRange(from: string, to: string): string[] {
  if (from > to) return [];
  return eachDayOfInterval({ start: parseDateStr(from), end: parseDateStr(to) }).map(fmtDateStr);
}

/** Formata um instante UTC no fuso do usuário, em português. */
export function fmtInTz(iso: string | Date, pattern: string, tz = DEFAULT_TZ) {
  return formatInTimeZone(typeof iso === "string" ? new Date(iso) : iso, tz, pattern, { locale: ptBR });
}

/** Formata 'yyyy-MM-dd' em português (ex.: "quarta, 22 de outubro"). */
export function fmtDate(dateStr: string, pattern = "EEEE, d 'de' MMMM") {
  return format(parseDateStr(dateStr), pattern, { locale: ptBR });
}

export function fmtShortDate(dateStr: string) {
  return format(parseDateStr(dateStr), "dd/MM", { locale: ptBR });
}

/** Hora local (0-23) de um instante no fuso. */
export function hourInTz(iso: string | Date, tz = DEFAULT_TZ) {
  return toZonedTime(typeof iso === "string" ? new Date(iso) : iso, tz).getHours();
}

export function minutesBetween(aIso: string, bIso: string) {
  return (new Date(bIso).getTime() - new Date(aIso).getTime()) / 60000;
}

export function timeToMinutes(t: string) {
  const [h, m] = normalizeTime(t).split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export type DayPeriods = { morning: string; afternoon: string; evening: string };
export const DEFAULT_PERIODS: DayPeriods = { morning: "05:00", afternoon: "12:00", evening: "18:00" };

/** Classifica um horário 'HH:mm' em manhã/tarde/noite conforme as preferências. */
export function periodOfTime(time: string, periods: DayPeriods = DEFAULT_PERIODS): "morning" | "afternoon" | "evening" {
  const m = timeToMinutes(time);
  if (m >= timeToMinutes(periods.evening) || m < timeToMinutes(periods.morning)) return "evening";
  if (m >= timeToMinutes(periods.afternoon)) return "afternoon";
  return "morning";
}

export function greetingFor(hour: number) {
  if (hour < 5) return "Boa madrugada";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export const PERIOD_LABEL: Record<"morning" | "afternoon" | "evening", string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite",
};

export function relativeDayLabel(dateStr: string, today: string) {
  const d = diffDays(dateStr, today);
  if (d === 0) return "Hoje";
  if (d === 1) return "Amanhã";
  if (d === -1) return "Ontem";
  return fmtDate(dateStr, "EEE, d MMM");
}
