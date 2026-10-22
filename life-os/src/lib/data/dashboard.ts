import type { UserContext } from "@/lib/context";
import { loadHabits, type HabitWithState } from "@/lib/data/habits";
import { loadTodayTasks, type TaskWithSubtasks } from "@/lib/data/tasks";
import { loadOccurrences, type EventOccurrence } from "@/lib/data/events";
import { loadSleepGoal, loadSleepLogs } from "@/lib/data/misc";
import { addDaysStr, dateRange, localToIso, toDateStr } from "@/lib/dates";
import { dayStatus } from "@/lib/habits";
import { sleepMetrics } from "@/lib/sleep";
import type { HomeChoreRow, SleepGoalRow, SleepLogRow } from "@/lib/database.types";

export interface DashboardData {
  habits: HabitWithState[];
  tasks: TaskWithSubtasks[];
  todayOccurrences: EventOccurrence[];
  nextOccurrence: EventOccurrence | null;
  sleepGoal: SleepGoalRow;
  lastSleep: SleepLogRow | null;
  lastSleepMinutes: number | null;
  focusTodayMinutes: number;
  screenTodayMinutes: number | null;
  constancyStreak: number;
  overdueChores: HomeChoreRow[];
  dayStatus: "on_track" | "pending" | "complete" | "empty";
}

export async function loadDashboard(ctx: UserContext): Promise<DashboardData> {
  const { supabase, user, today, tz } = ctx;
  const nowIso = new Date().toISOString();
  const dayStart = localToIso(today, "00:00", tz);

  const [habitsAll, tasks, occurrences, sleepGoal, sleepLogs, focusRes, screenRes, choresRes] = await Promise.all([
    loadHabits(ctx, { status: ["active"] }),
    loadTodayTasks(ctx),
    loadOccurrences(ctx, today, addDaysStr(today, 14)),
    loadSleepGoal(ctx),
    loadSleepLogs(ctx, 3),
    supabase.from("focus_sessions").select("actual_seconds,started_at").eq("user_id", user.id).gte("started_at", dayStart),
    supabase.from("screen_time_logs").select("total_minutes,source").eq("user_id", user.id).eq("date", today),
    supabase.from("home_chores").select("*").eq("user_id", user.id).eq("is_active", true).lt("next_due_date", today),
  ]);

  const dashboardIds = ctx.profile.dashboard_habit_ids ?? [];
  const habits = habitsAll.filter((h) => (dashboardIds.length ? dashboardIds.includes(h.habit.id) : h.habit.show_on_dashboard));

  const todayOccurrences = occurrences.filter((o) => toDateStr(o.start_at, tz) === today);
  const nextOccurrence = occurrences.find((o) => o.end_at >= nowIso) ?? null;

  const lastSleep = sleepLogs[0] ?? null;
  const focusTodayMinutes = Math.round((focusRes.data ?? []).reduce((a, s) => a + s.actual_seconds, 0) / 60);
  const screenRows = screenRes.data ?? [];
  const screenTodayMinutes = screenRows.length ? Math.max(...screenRows.map((r) => r.total_minutes)) : null;

  // Sequência de constância: dias seguidos (até hoje) com ≥70% dos hábitos programados feitos/justificados.
  let constancyStreak = 0;
  const lookback = dateRange(addDaysStr(today, -180), today).reverse();
  for (const d of lookback) {
    let scheduled = 0,
      ok = 0;
    for (const h of habitsAll) {
      const comp = h.completions.find((c) => c.date === d);
      const st = dayStatus(h.habit, h.schedules, comp, d, today);
      if (st === "not_scheduled") continue;
      scheduled++;
      if (st === "done" || st === "skipped") ok++;
    }
    if (scheduled === 0) {
      if (d === today) continue;
      break;
    }
    const ratio = ok / scheduled;
    if (d === today) {
      if (ratio >= 0.7) constancyStreak++;
      continue; // hoje incompleto não quebra
    }
    if (ratio >= 0.7) constancyStreak++;
    else break;
  }

  const scheduledToday = habitsAll.filter((h) => h.todayStatus !== "not_scheduled");
  const habitsDone = scheduledToday.filter((h) => h.todayStatus === "done" || h.todayStatus === "skipped").length;
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const overdueTasks = pendingTasks.filter((t) => t.due_date && t.due_date < today);
  const overdueChores = choresRes.data ?? [];

  let status: DashboardData["dayStatus"] = "on_track";
  if (!scheduledToday.length && !tasks.length && !todayOccurrences.length) status = "empty";
  else if (overdueTasks.length || overdueChores.length) status = "pending";
  else if (habitsDone === scheduledToday.length && pendingTasks.length === 0) status = "complete";

  return {
    habits,
    tasks,
    todayOccurrences,
    nextOccurrence,
    sleepGoal,
    lastSleep,
    lastSleepMinutes: lastSleep ? Math.round(sleepMetrics(lastSleep).asleepMin) : null,
    focusTodayMinutes,
    screenTodayMinutes,
    constancyStreak,
    overdueChores,
    dayStatus: status,
  };
}
