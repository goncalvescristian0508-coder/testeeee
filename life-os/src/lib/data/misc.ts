import type { UserContext } from "@/lib/context";
import { addDaysStr } from "@/lib/dates";

export async function loadSleepGoal(ctx: UserContext) {
  const { data } = await ctx.supabase.from("sleep_goals").select("*").eq("user_id", ctx.user.id).maybeSingle();
  if (data) return data;
  const { data: created } = await ctx.supabase.from("sleep_goals").upsert({ user_id: ctx.user.id }).select("*").single();
  return created!;
}

export async function loadSleepLogs(ctx: UserContext, days = 30) {
  const { data } = await ctx.supabase.from("sleep_logs").select("*").eq("user_id", ctx.user.id).gte("date", addDaysStr(ctx.today, -days)).order("date", { ascending: false });
  return data ?? [];
}

export async function loadFocusSessions(ctx: UserContext, days = 30) {
  const since = new Date(Date.now() - (days + 1) * 86400000).toISOString();
  const { data } = await ctx.supabase.from("focus_sessions").select("*").eq("user_id", ctx.user.id).gte("started_at", since).order("started_at", { ascending: false });
  return data ?? [];
}

export async function loadScreenTimeLogs(ctx: UserContext, days = 30) {
  const { data } = await ctx.supabase.from("screen_time_logs").select("*").eq("user_id", ctx.user.id).gte("date", addDaysStr(ctx.today, -days)).order("date", { ascending: false });
  return data ?? [];
}

export async function loadScreenTimeGoals(ctx: UserContext) {
  const { data } = await ctx.supabase.from("screen_time_goals").select("*").eq("user_id", ctx.user.id);
  return data ?? [];
}

export async function loadNotificationPreferences(ctx: UserContext) {
  const { data } = await ctx.supabase.from("notification_preferences").select("*").eq("user_id", ctx.user.id).maybeSingle();
  if (data) return data;
  const { data: created } = await ctx.supabase.from("notification_preferences").upsert({ user_id: ctx.user.id }).select("*").single();
  return created!;
}
