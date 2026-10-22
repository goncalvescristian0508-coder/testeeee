import type { UserContext } from "@/lib/context";
import { addDaysStr } from "@/lib/dates";
import { completionRate, computeStreaks, dayStatus, weeklyCount, type HabitDayStatus } from "@/lib/habits";
import type { HabitCompletionRow, HabitRow, HabitScheduleRow } from "@/lib/database.types";

export interface HabitWithState {
  habit: HabitRow;
  schedules: HabitScheduleRow[];
  completions: HabitCompletionRow[];
  todayStatus: HabitDayStatus;
  todayCompletion: HabitCompletionRow | undefined;
  streak: { current: number; longest: number };
  weekRate: number;
  monthRate: number;
  weeklyDone: number; // para "x vezes por semana"
  currentSchedule: HabitScheduleRow | null;
}

/** Carrega hábitos do usuário com estado de hoje, sequências e taxas. */
export async function loadHabits(ctx: UserContext, opts: { status?: ("active" | "paused" | "archived")[]; lookbackDays?: number } = {}) {
  const { supabase, user, today, weekStartsOn } = ctx;
  const statuses = opts.status ?? ["active", "paused", "archived"];
  const lookback = opts.lookbackDays ?? 400;
  const since = addDaysStr(today, -lookback);

  const [{ data: habits }, { data: schedules }, { data: completions }] = await Promise.all([
    supabase.from("habits").select("*").eq("user_id", user.id).in("status", statuses).order("sort_order").order("created_at"),
    supabase.from("habit_schedules").select("*").eq("user_id", user.id).order("effective_from"),
    supabase.from("habit_completions").select("*").eq("user_id", user.id).gte("date", since).order("date"),
  ]);

  const schedByHabit = new Map<string, HabitScheduleRow[]>();
  for (const s of schedules ?? []) schedByHabit.set(s.habit_id, [...(schedByHabit.get(s.habit_id) ?? []), s]);
  const compByHabit = new Map<string, HabitCompletionRow[]>();
  for (const c of completions ?? []) compByHabit.set(c.habit_id, [...(compByHabit.get(c.habit_id) ?? []), c]);

  const weekStart = startOfWeek(today, weekStartsOn);
  const monthStart = today.slice(0, 7) + "-01";

  const result: HabitWithState[] = (habits ?? []).map((habit) => {
    const sch = schedByHabit.get(habit.id) ?? [];
    const comps = compByHabit.get(habit.id) ?? [];
    const todayCompletion = comps.find((c) => c.date === today);
    const currentSchedule = sch.filter((s) => s.effective_from <= today && (!s.effective_to || s.effective_to >= today)).sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null;
    return {
      habit,
      schedules: sch,
      completions: comps,
      todayCompletion,
      todayStatus: dayStatus(habit, sch, todayCompletion, today, today),
      streak: computeStreaks(habit, sch, comps, today),
      weekRate: completionRate(habit, sch, comps, weekStart, today, today).rate,
      monthRate: completionRate(habit, sch, comps, monthStart, today, today).rate,
      weeklyDone: weeklyCount(habit.id, comps, today, weekStartsOn),
      currentSchedule,
    };
  });
  return result;
}

function startOfWeek(date: string, weekStartsOn: number) {
  const d = new Date(date + "T12:00:00Z");
  const diff = (d.getUTCDay() - weekStartsOn + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}
