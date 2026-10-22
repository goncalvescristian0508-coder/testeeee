import type { UserContext } from "@/lib/context";
import type { GoalProgressRow, PersonalGoalRow } from "@/lib/database.types";

export interface GoalWithHistory extends PersonalGoalRow {
  history: GoalProgressRow[];
}

export async function loadGoals(ctx: UserContext): Promise<GoalWithHistory[]> {
  const { supabase, user } = ctx;
  const [{ data: goals }, { data: progress }] = await Promise.all([
    supabase.from("personal_goals").select("*").eq("user_id", user.id).order("status").order("deadline", { ascending: true, nullsFirst: false }).order("created_at"),
    supabase.from("goal_progress").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
  ]);
  const by = new Map<string, GoalProgressRow[]>();
  for (const p of progress ?? []) by.set(p.goal_id, [...(by.get(p.goal_id) ?? []), p]);
  return (goals ?? []).map((g) => ({ ...g, history: (by.get(g.id) ?? []).slice(0, 20) }));
}
