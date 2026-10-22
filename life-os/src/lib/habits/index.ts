/**
 * Regras de hábitos: programação por dia, status diário, sequências e taxas.
 * Dias em que o hábito não estava programado nunca contam contra o usuário.
 */
import { addDaysStr, dateRange, diffDays, weekdayOf, startOfWeekStr } from "@/lib/dates";
import type { HabitCompletionRow, HabitRow, HabitScheduleRow } from "@/lib/database.types";

export type HabitDayStatus = "not_scheduled" | "pending" | "done" | "skipped" | "missed";

export type ScheduleLike = Pick<HabitScheduleRow, "frequency" | "weekdays" | "times_per_week" | "effective_from" | "effective_to">;
export type HabitLike = Pick<HabitRow, "id" | "start_date" | "status" | "kind" | "target_value">;
export type CompletionLike = Pick<HabitCompletionRow, "habit_id" | "date" | "status" | "value">;

/** Programação vigente para uma data. */
export function scheduleFor(schedules: ScheduleLike[], date: string): ScheduleLike | null {
  let best: ScheduleLike | null = null;
  for (const s of schedules) {
    if (s.effective_from > date) continue;
    if (s.effective_to && s.effective_to < date) continue;
    if (!best || s.effective_from > best.effective_from) best = s;
  }
  return best;
}

/** O hábito estava programado nesse dia? (times_per_week conta como "qualquer dia") */
export function isScheduled(habit: HabitLike, schedules: ScheduleLike[], date: string): boolean {
  if (date < habit.start_date) return false;
  const s = scheduleFor(schedules, date);
  if (!s) return true; // sem programação explícita = diário
  if (s.frequency === "daily") return true;
  if (s.frequency === "weekdays") return s.weekdays.includes(weekdayOf(date));
  return true; // times_per_week: flexível, qualquer dia vale
}

/** Conclusão satisfaz a meta? (quantidade/duração precisam atingir target) */
export function completionCounts(habit: HabitLike, c: CompletionLike | undefined): boolean {
  if (!c || c.status !== "done") return false;
  if (habit.kind === "boolean" || habit.target_value == null) return true;
  return (c.value ?? 0) >= habit.target_value;
}

export function dayStatus(habit: HabitLike, schedules: ScheduleLike[], completion: CompletionLike | undefined, date: string, today: string): HabitDayStatus {
  if (completion?.status === "done") return completionCounts(habit, completion) ? "done" : date < today ? "missed" : "pending";
  if (completion?.status === "skipped") return "skipped";
  if (!isScheduled(habit, schedules, date)) return "not_scheduled";
  if (date > today) return "not_scheduled";
  return date < today ? "missed" : "pending";
}

export interface StreakResult {
  current: number;
  longest: number;
}

/**
 * Sequência atual: dias programados consecutivos concluídos (ou justificados),
 * contando de hoje para trás. Dias não programados são "transparentes".
 * Hoje pendente não quebra a sequência.
 */
export function computeStreaks(habit: HabitLike, schedules: ScheduleLike[], completions: CompletionLike[], today: string, lookbackDays = 365): StreakResult {
  const byDate = new Map(completions.filter((c) => c.habit_id === habit.id).map((c) => [c.date, c]));
  const from = habit.start_date > addDaysStr(today, -lookbackDays) ? habit.start_date : addDaysStr(today, -lookbackDays);
  if (from > today) return { current: 0, longest: 0 };
  const days = dateRange(from, today);

  let longest = 0;
  let run = 0;
  for (const d of days) {
    const st = dayStatus(habit, schedules, byDate.get(d), d, today);
    if (st === "done") run++;
    else if (st === "missed") run = 0;
    else if (st === "pending" || st === "not_scheduled" || st === "skipped") continue;
    if (run > longest) longest = run;
  }

  // sequência atual: de trás para frente
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    const st = dayStatus(habit, schedules, byDate.get(d), d, today);
    if (st === "done") current++;
    else if (st === "missed") break;
    // pending (hoje), skipped e not_scheduled não quebram
  }
  return { current, longest: Math.max(longest, current) };
}

export interface RateResult {
  scheduled: number;
  done: number;
  skipped: number;
  rate: number; // 0-100, ignora dias não programados e justificados
}

/** Taxa de conclusão em um intervalo inclusivo (até hoje). */
export function completionRate(habit: HabitLike, schedules: ScheduleLike[], completions: CompletionLike[], from: string, to: string, today: string): RateResult {
  const byDate = new Map(completions.filter((c) => c.habit_id === habit.id).map((c) => [c.date, c]));
  const end = to < today ? to : today;
  let scheduled = 0,
    done = 0,
    skipped = 0;
  for (const d of dateRange(from, end)) {
    const st = dayStatus(habit, schedules, byDate.get(d), d, today);
    if (st === "not_scheduled") continue;
    if (st === "skipped") {
      skipped++;
      continue;
    }
    if (st === "pending") continue; // hoje ainda aberto
    scheduled++;
    if (st === "done") done++;
  }
  return { scheduled, done, skipped, rate: scheduled ? Math.round((done / scheduled) * 100) : 0 };
}

/** Para frequência "x vezes por semana": quantas conclusões na semana da data. */
export function weeklyCount(habitId: string, completions: CompletionLike[], date: string, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1) {
  const start = startOfWeekStr(date, weekStartsOn);
  const end = addDaysStr(start, 6);
  return completions.filter((c) => c.habit_id === habitId && c.status === "done" && c.date >= start && c.date <= end).length;
}

export function daysSince(dateStr: string, today: string) {
  return diffDays(today, dateStr);
}

/** Frases de incentivo discretas (sem culpa). */
export function encouragement(rate: number, streak: number): string {
  if (streak >= 30) return "Um mês de constância. Isso já é parte de quem você é.";
  if (streak >= 7) return "Uma semana seguida. Continue no seu ritmo.";
  if (rate >= 80) return "Semana sólida. Pequenas ações, grandes resultados.";
  if (rate >= 50) return "Metade do caminho feito. Cada dia conta.";
  if (rate > 0) return "Recomeçar faz parte. Um passo de cada vez.";
  return "Hoje é um bom dia para começar.";
}
