"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext, fail, type ActionResult } from "@/lib/context";
import { addDaysStr, isValidDateStr } from "@/lib/dates";

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Dê um título à tarefa.").max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  due_date: z.string().refine((s) => !s || isValidDateStr(s), "Data inválida.").nullable().optional().or(z.literal("")),
  due_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional().or(z.literal("")),
  period: z.enum(["morning", "afternoon", "evening"]).nullable().optional().or(z.literal("")),
  priority: z.coerce.number().int().min(1).max(3).default(2),
  category_id: z.string().uuid().nullable().optional(),
  estimated_minutes: z.coerce.number().int().min(0).max(1440).nullable().optional(),
  is_priority: z.boolean().default(false),
  subtasks: z.array(z.object({ id: z.string().optional(), title: z.string().trim().min(1).max(120), done: z.boolean().default(false) })).default([]),
});

export type TaskInput = z.input<typeof taskSchema>;

function revalidate() {
  revalidatePath("/dashboard");
  revalidatePath("/tarefas");
  revalidatePath("/agenda");
  revalidatePath("/estatisticas");
}

function clean(d: z.output<typeof taskSchema>) {
  return {
    title: d.title,
    description: d.description || null,
    due_date: d.due_date || null,
    due_time: d.due_time || null,
    period: d.period || null,
    priority: d.priority,
    category_id: d.category_id ?? null,
    estimated_minutes: d.estimated_minutes ?? null,
    is_priority: d.is_priority,
  };
}

export async function createTask(input: TaskInput): Promise<ActionResult<{ id: string }>> {
  try {
    const data = taskSchema.parse(input);
    const { supabase, user } = await requireContext();
    const { data: task, error } = await supabase.from("tasks").insert({ ...clean(data), user_id: user.id }).select("id").single();
    if (error) throw error;
    if (data.subtasks.length) {
      const { error: e2 } = await supabase.from("task_subtasks").insert(data.subtasks.map((s, i) => ({ task_id: task.id, user_id: user.id, title: s.title, done: s.done, sort_order: i })));
      if (e2) throw e2;
    }
    revalidate();
    return { ok: true, data: { id: task.id } };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

export async function updateTask(id: string, input: TaskInput): Promise<ActionResult> {
  try {
    const data = taskSchema.parse(input);
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("tasks").update(clean(data)).eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    // Sincroniza subtarefas: remove as ausentes, atualiza/insere as demais.
    const { data: existing } = await supabase.from("task_subtasks").select("id").eq("task_id", id);
    const keep = new Set(data.subtasks.map((s) => s.id).filter(Boolean));
    const toDelete = (existing ?? []).filter((s) => !keep.has(s.id)).map((s) => s.id);
    if (toDelete.length) await supabase.from("task_subtasks").delete().in("id", toDelete);
    for (const [i, s] of data.subtasks.entries()) {
      if (s.id) await supabase.from("task_subtasks").update({ title: s.title, done: s.done, sort_order: i }).eq("id", s.id).eq("user_id", user.id);
      else await supabase.from("task_subtasks").insert({ task_id: id, user_id: user.id, title: s.title, done: s.done, sort_order: i });
    }
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

export async function toggleTask(id: string, done: boolean): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase
      .from("tasks")
      .update({ status: done ? "done" : "pending", completed_at: done ? new Date().toISOString() : null })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleSubtask(id: string, done: boolean): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("task_subtasks").update({ done }).eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Adia a tarefa (registra o adiamento para o resumo semanal). */
export async function postponeTask(id: string, days = 1): Promise<ActionResult> {
  try {
    const { supabase, user, today } = await requireContext();
    const { data: task } = await supabase.from("tasks").select("due_date,postponed_count").eq("id", id).eq("user_id", user.id).single();
    const base = task?.due_date && task.due_date > today ? task.due_date : today;
    const { error } = await supabase
      .from("tasks")
      .update({ due_date: addDaysStr(base, days), postponed_count: (task?.postponed_count ?? 0) + 1 })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("tasks").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setTaskPriority(id: string, isPriority: boolean): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("tasks").update({ is_priority: isPriority }).eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
