"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext, fail, type ActionResult } from "@/lib/context";
import { toDateStr } from "@/lib/dates";
import { nextDueDate } from "@/lib/home";

export const choreSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à tarefa.").max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  every_days: z.coerce.number().int().min(1, "Mínimo 1 dia.").max(365),
  preferred_weekday: z.coerce.number().int().min(0).max(6).nullable().optional(),
  estimated_minutes: z.coerce.number().int().min(0).max(1440).nullable().optional(),
  items: z.array(z.object({ id: z.string().optional(), title: z.string().trim().min(1).max(120) })).default([]),
});
export type ChoreInput = z.input<typeof choreSchema>;

function revalidate() {
  revalidatePath("/casa");
  revalidatePath("/dashboard");
}

export async function createChore(input: ChoreInput): Promise<ActionResult<{ id: string }>> {
  try {
    const d = choreSchema.parse(input);
    const { supabase, user, today } = await requireContext();
    const { data: chore, error } = await supabase
      .from("home_chores")
      .insert({ user_id: user.id, name: d.name, description: d.description || null, every_days: d.every_days, preferred_weekday: d.preferred_weekday ?? null, estimated_minutes: d.estimated_minutes ?? null, next_due_date: nextDueDate(null, d.every_days, d.preferred_weekday ?? null, today) })
      .select("id")
      .single();
    if (error) throw error;
    if (d.items.length) {
      const { error: e2 } = await supabase.from("home_chore_items").insert(d.items.map((it, i) => ({ chore_id: chore.id, user_id: user.id, title: it.title, sort_order: i })));
      if (e2) throw e2;
    }
    revalidate();
    return { ok: true, data: { id: chore.id } };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

export async function updateChore(id: string, input: ChoreInput): Promise<ActionResult> {
  try {
    const d = choreSchema.parse(input);
    const { supabase, user, today, tz } = await requireContext();
    const { data: current } = await supabase.from("home_chores").select("last_done_at").eq("id", id).eq("user_id", user.id).single();
    const lastDate = current?.last_done_at ? toDateStr(current.last_done_at, tz) : null;
    const { error } = await supabase
      .from("home_chores")
      .update({ name: d.name, description: d.description || null, every_days: d.every_days, preferred_weekday: d.preferred_weekday ?? null, estimated_minutes: d.estimated_minutes ?? null, next_due_date: nextDueDate(lastDate, d.every_days, d.preferred_weekday ?? null, today) })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    const { data: existing } = await supabase.from("home_chore_items").select("id").eq("chore_id", id);
    const keep = new Set(d.items.map((i) => i.id).filter(Boolean));
    const toDelete = (existing ?? []).filter((i) => !keep.has(i.id)).map((i) => i.id);
    if (toDelete.length) await supabase.from("home_chore_items").delete().in("id", toDelete);
    for (const [i, it] of d.items.entries()) {
      if (it.id) await supabase.from("home_chore_items").update({ title: it.title, sort_order: i }).eq("id", it.id);
      else await supabase.from("home_chore_items").insert({ chore_id: id, user_id: user.id, title: it.title, sort_order: i });
    }
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

export async function deleteChore(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("home_chores").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setChoreActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("home_chores").update({ is_active: active }).eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleChoreItem(itemId: string, done: boolean): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("home_chore_items").update({ done }).eq("id", itemId).eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Conclui a tarefa (total ou parcial), registra no histórico e calcula a próxima data. */
export async function completeChore(id: string, opts: { partial?: boolean; durationMinutes?: number | null; note?: string } = {}): Promise<ActionResult> {
  try {
    const { supabase, user, today } = await requireContext();
    const { data: chore } = await supabase.from("home_chores").select("*").eq("id", id).eq("user_id", user.id).single();
    if (!chore) throw new Error("Tarefa não encontrada.");
    const { data: items } = await supabase.from("home_chore_items").select("id,done").eq("chore_id", id);
    const total = items?.length ?? 0;
    const done = items?.filter((i) => i.done).length ?? 0;
    const partial = opts.partial ?? (total > 0 && done < total);
    const { error: le } = await supabase.from("home_chore_logs").insert({ chore_id: id, user_id: user.id, partial, items_done: total ? done : null, items_total: total || null, duration_minutes: opts.durationMinutes ?? null, note: opts.note || null });
    if (le) throw le;
    if (!partial) {
      const { error } = await supabase.from("home_chores").update({ last_done_at: new Date().toISOString(), next_due_date: nextDueDate(today, chore.every_days, chore.preferred_weekday, today) }).eq("id", id);
      if (error) throw error;
      if (total) await supabase.from("home_chore_items").update({ done: false }).eq("chore_id", id);
    }
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
