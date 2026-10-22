import type { UserContext } from "@/lib/context";
import type { TaskRow, TaskSubtaskRow } from "@/lib/database.types";

export interface TaskWithSubtasks extends TaskRow {
  subtasks: TaskSubtaskRow[];
}

export async function loadTasks(ctx: UserContext, opts: { from?: string; to?: string; includeDone?: boolean; onlyOverdue?: boolean } = {}): Promise<TaskWithSubtasks[]> {
  const { supabase, user, today } = ctx;
  let q = supabase.from("tasks").select("*").eq("user_id", user.id).order("due_date", { ascending: true, nullsFirst: false }).order("due_time", { ascending: true, nullsFirst: false }).order("priority").order("created_at");
  if (opts.from) q = q.gte("due_date", opts.from);
  if (opts.to) q = q.lte("due_date", opts.to);
  if (opts.onlyOverdue) q = q.lt("due_date", today).eq("status", "pending");
  if (!opts.includeDone) q = q.neq("status", "done");
  const { data: tasks } = await q;
  const ids = (tasks ?? []).map((t) => t.id);
  const { data: subs } = ids.length ? await supabase.from("task_subtasks").select("*").in("task_id", ids).order("sort_order") : { data: [] as TaskSubtaskRow[] };
  const byTask = new Map<string, TaskSubtaskRow[]>();
  for (const s of subs ?? []) byTask.set(s.task_id, [...(byTask.get(s.task_id) ?? []), s]);
  return (tasks ?? []).map((t) => ({ ...t, subtasks: byTask.get(t.id) ?? [] }));
}

/** Tarefas de hoje + atrasadas + sem data (visão "hoje"). */
export async function loadTodayTasks(ctx: UserContext) {
  const { supabase, user, today } = ctx;
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .or(`due_date.lte.${today},due_date.is.null,and(status.eq.done,completed_at.gte.${today}T00:00:00)`)
    .order("due_time", { ascending: true, nullsFirst: false })
    .order("priority")
    .order("created_at");
  const list = (tasks ?? []).filter((t) => t.status === "pending" || (t.status === "done" && t.due_date === today) || (t.status === "done" && t.completed_at && t.completed_at.slice(0, 10) >= today));
  const ids = list.map((t) => t.id);
  const { data: subs } = ids.length ? await supabase.from("task_subtasks").select("*").in("task_id", ids).order("sort_order") : { data: [] as TaskSubtaskRow[] };
  const byTask = new Map<string, TaskSubtaskRow[]>();
  for (const s of subs ?? []) byTask.set(s.task_id, [...(byTask.get(s.task_id) ?? []), s]);
  return list.map((t) => ({ ...t, subtasks: byTask.get(t.id) ?? [] })) as TaskWithSubtasks[];
}
