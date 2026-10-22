import type { UserContext } from "@/lib/context";
import type { HomeChoreItemRow, HomeChoreLogRow, HomeChoreRow } from "@/lib/database.types";

export interface ChoreWithItems extends HomeChoreRow {
  items: HomeChoreItemRow[];
  logs: HomeChoreLogRow[];
}

export async function loadChores(ctx: UserContext): Promise<ChoreWithItems[]> {
  const { supabase, user } = ctx;
  const [{ data: chores }, { data: items }, { data: logs }] = await Promise.all([
    supabase.from("home_chores").select("*").eq("user_id", user.id).order("next_due_date", { ascending: true, nullsFirst: true }).order("sort_order"),
    supabase.from("home_chore_items").select("*").eq("user_id", user.id).order("sort_order"),
    supabase.from("home_chore_logs").select("*").eq("user_id", user.id).order("done_at", { ascending: false }).limit(200),
  ]);
  const byChore = new Map<string, HomeChoreItemRow[]>();
  for (const i of items ?? []) byChore.set(i.chore_id, [...(byChore.get(i.chore_id) ?? []), i]);
  const logsBy = new Map<string, HomeChoreLogRow[]>();
  for (const l of logs ?? []) logsBy.set(l.chore_id, [...(logsBy.get(l.chore_id) ?? []), l]);
  return (chores ?? []).map((c) => ({ ...c, items: byChore.get(c.id) ?? [], logs: (logsBy.get(c.id) ?? []).slice(0, 10) }));
}
