"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext, fail, type ActionResult } from "@/lib/context";
import { isValidDateStr } from "@/lib/dates";

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à meta.").max(100),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  kind: z.enum(["numeric", "completion"]).default("numeric"),
  target_value: z.coerce.number().positive().nullable().optional(),
  unit: z.string().trim().max(20).optional().or(z.literal("")),
  start_date: z.string().refine(isValidDateStr, "Data inválida."),
  deadline: z.string().refine((s) => !s || isValidDateStr(s), "Data inválida.").optional().or(z.literal("")),
  related_habit_ids: z.array(z.string().uuid()).default([]),
});
export type GoalInput = z.input<typeof goalSchema>;

function revalidate() {
  revalidatePath("/metas");
  revalidatePath("/estatisticas");
}

export async function createGoal(input: GoalInput): Promise<ActionResult<{ id: string }>> {
  try {
    const d = goalSchema.parse(input);
    if (d.kind === "numeric" && !d.target_value) return { ok: false, error: "Informe o valor desejado." };
    const { supabase, user } = await requireContext();
    const { data, error } = await supabase
      .from("personal_goals")
      .insert({ user_id: user.id, name: d.name, description: d.description || null, kind: d.kind, target_value: d.kind === "numeric" ? d.target_value! : 1, unit: d.unit || null, start_date: d.start_date, deadline: d.deadline || null, related_habit_ids: d.related_habit_ids })
      .select("id")
      .single();
    if (error) throw error;
    revalidate();
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

export async function updateGoal(id: string, input: GoalInput): Promise<ActionResult> {
  try {
    const d = goalSchema.parse(input);
    const { supabase, user } = await requireContext();
    const { error } = await supabase
      .from("personal_goals")
      .update({ name: d.name, description: d.description || null, kind: d.kind, target_value: d.kind === "numeric" ? (d.target_value ?? null) : 1, unit: d.unit || null, start_date: d.start_date, deadline: d.deadline || null, related_habit_ids: d.related_habit_ids })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

/** Adiciona progresso (delta) ou define valor absoluto; grava no histórico. */
export async function addGoalProgress(id: string, opts: { delta?: number; value?: number; note?: string }): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { data: goal } = await supabase.from("personal_goals").select("*").eq("id", id).eq("user_id", user.id).single();
    if (!goal) throw new Error("Meta não encontrada.");
    const after = opts.value != null ? Math.max(0, opts.value) : Math.max(0, Number(goal.current_value) + (opts.delta ?? 0));
    const delta = after - Number(goal.current_value);
    const completed = goal.target_value != null && after >= Number(goal.target_value);
    const { error } = await supabase
      .from("personal_goals")
      .update({ current_value: after, status: completed ? "completed" : goal.status === "completed" ? "active" : goal.status, completed_at: completed ? (goal.completed_at ?? new Date().toISOString()) : null })
      .eq("id", id);
    if (error) throw error;
    const { error: pe } = await supabase.from("goal_progress").insert({ goal_id: id, user_id: user.id, delta, value_after: after, note: opts.note || null });
    if (pe) throw pe;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setGoalStatus(id: string, status: "active" | "completed" | "archived"): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("personal_goals").update({ status, completed_at: status === "completed" ? new Date().toISOString() : null }).eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    if (status === "completed") await supabase.from("goal_progress").insert({ goal_id: id, user_id: user.id, delta: 0, value_after: 0, note: "Marcada como concluída" });
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("personal_goals").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
