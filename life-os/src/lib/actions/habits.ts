"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext, fail, type ActionResult } from "@/lib/context";
import { isValidDateStr } from "@/lib/dates";

const timeRe = /^\d{2}:\d{2}(:\d{2})?$/;

export const habitSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao hábito.").max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  icon: z.string().max(30).default("check"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#22c55e"),
  category_id: z.string().uuid().nullable().optional(),
  kind: z.enum(["boolean", "quantity", "duration"]).default("boolean"),
  target_value: z.coerce.number().positive().nullable().optional(),
  unit: z.string().trim().max(20).optional().or(z.literal("")),
  recommended_time: z.string().regex(timeRe).nullable().optional().or(z.literal("")),
  estimated_minutes: z.coerce.number().int().min(0).max(1440).nullable().optional(),
  period: z.enum(["morning", "afternoon", "evening"]).nullable().optional().or(z.literal("")),
  start_date: z.string().refine(isValidDateStr, "Data inválida."),
  reminder_time: z.string().regex(timeRe).nullable().optional().or(z.literal("")),
  reminder_enabled: z.boolean().default(false),
  priority: z.coerce.number().int().min(1).max(3).default(2),
  show_on_dashboard: z.boolean().default(true),
  frequency: z.enum(["daily", "weekdays", "times_per_week"]).default("daily"),
  weekdays: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
  times_per_week: z.coerce.number().int().min(1).max(7).nullable().optional(),
});

export type HabitInput = z.input<typeof habitSchema>;

function clean(data: z.output<typeof habitSchema>) {
  return {
    name: data.name,
    description: data.description || null,
    icon: data.icon,
    color: data.color,
    category_id: data.category_id ?? null,
    kind: data.kind,
    target_value: data.kind === "boolean" ? null : (data.target_value ?? null),
    unit: data.kind === "boolean" ? null : data.kind === "duration" ? "min" : data.unit || null,
    recommended_time: data.recommended_time || null,
    estimated_minutes: data.estimated_minutes ?? null,
    period: data.period || null,
    start_date: data.start_date,
    reminder_time: data.reminder_time || null,
    reminder_enabled: data.reminder_enabled && !!data.reminder_time,
    priority: data.priority,
    show_on_dashboard: data.show_on_dashboard,
  };
}

function revalidate() {
  revalidatePath("/habitos");
  revalidatePath("/dashboard");
  revalidatePath("/estatisticas");
}

export async function createHabit(input: HabitInput): Promise<ActionResult<{ id: string }>> {
  try {
    const data = habitSchema.parse(input);
    const { supabase, user } = await requireContext();
    const { count } = await supabase.from("habits").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    const { data: habit, error } = await supabase
      .from("habits")
      .insert({ ...clean(data), user_id: user.id, sort_order: count ?? 0 })
      .select("id")
      .single();
    if (error) throw error;
    const { error: e2 } = await supabase.from("habit_schedules").insert({
      habit_id: habit.id,
      user_id: user.id,
      frequency: data.frequency,
      weekdays: data.frequency === "daily" ? [0, 1, 2, 3, 4, 5, 6] : data.weekdays,
      times_per_week: data.frequency === "times_per_week" ? (data.times_per_week ?? 3) : null,
      effective_from: data.start_date,
    });
    if (e2) throw e2;
    revalidate();
    return { ok: true, data: { id: habit.id } };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

export async function updateHabit(id: string, input: HabitInput): Promise<ActionResult> {
  try {
    const data = habitSchema.parse(input);
    const { supabase, user, today } = await requireContext();
    const { error } = await supabase.from("habits").update(clean(data)).eq("id", id).eq("user_id", user.id);
    if (error) throw error;

    // Programação: se mudou, encerra a vigente e cria uma nova a partir de hoje
    // (histórico preservado: dias passados continuam avaliados pela regra antiga).
    const { data: current } = await supabase.from("habit_schedules").select("*").eq("habit_id", id).is("effective_to", null).order("effective_from", { ascending: false }).limit(1).maybeSingle();
    const weekdays = data.frequency === "daily" ? [0, 1, 2, 3, 4, 5, 6] : data.weekdays;
    const tpw = data.frequency === "times_per_week" ? (data.times_per_week ?? 3) : null;
    const changed = !current || current.frequency !== data.frequency || current.times_per_week !== tpw || JSON.stringify([...current.weekdays].sort()) !== JSON.stringify([...weekdays].sort());
    if (changed) {
      if (current) {
        if (current.effective_from >= today) {
          // Programação criada hoje (ou futura): substitui sem deixar histórico vazio.
          await supabase.from("habit_schedules").delete().eq("id", current.id);
        } else {
          // Encerra a vigente ontem (effective_to é inclusivo).
          await supabase.from("habit_schedules").update({ effective_to: prevDay(today) }).eq("id", current.id);
        }
      }
      const from = current && current.effective_from > today ? current.effective_from : today;
      const { error: e2 } = await supabase.from("habit_schedules").insert({ habit_id: id, user_id: user.id, frequency: data.frequency, weekdays, times_per_week: tpw, effective_from: from });
      if (e2) throw e2;
    }
    revalidate();
    revalidatePath(`/habitos/${id}`);
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

function prevDay(d: string) {
  const dt = new Date(d + "T12:00:00Z");
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export async function setHabitStatus(id: string, status: "active" | "paused" | "archived"): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("habits").update({ status }).eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    revalidatePath(`/habitos/${id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteHabit(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("habits").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reorderHabits(ids: string[]): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    await Promise.all(ids.map((id, i) => supabase.from("habits").update({ sort_order: i }).eq("id", id).eq("user_id", user.id)));
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const completionSchema = z.object({
  habitId: z.string().uuid(),
  date: z.string().refine(isValidDateStr, "Data inválida."),
  status: z.enum(["done", "skipped"]).default("done"),
  value: z.coerce.number().min(0).nullable().optional(),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

/** Registra (ou atualiza) a conclusão de um dia. Idempotente por (hábito, dia). */
export async function setCompletion(input: z.input<typeof completionSchema>): Promise<ActionResult> {
  try {
    const data = completionSchema.parse(input);
    const { supabase, user, today } = await requireContext();
    if (data.date > today) return { ok: false, error: "Não é possível registrar dias futuros." };
    const { error } = await supabase.from("habit_completions").upsert(
      { habit_id: data.habitId, user_id: user.id, date: data.date, status: data.status, value: data.value ?? null, note: data.note || null, completed_at: new Date().toISOString() },
      { onConflict: "habit_id,date" },
    );
    if (error) throw error;
    revalidate();
    revalidatePath(`/habitos/${data.habitId}`);
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

/** Remove o registro do dia (desmarcar). */
export async function clearCompletion(habitId: string, date: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("habit_completions").delete().eq("habit_id", habitId).eq("date", date).eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    revalidatePath(`/habitos/${habitId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Alterna conclusão do dia (marcar/desmarcar) para hábitos sim/não. */
export async function toggleCompletion(habitId: string, date: string, value?: number): Promise<ActionResult<{ done: boolean }>> {
  try {
    const { supabase, user, today } = await requireContext();
    if (date > today) return { ok: false, error: "Não é possível registrar dias futuros." };
    const { data: existing } = await supabase.from("habit_completions").select("id,status").eq("habit_id", habitId).eq("date", date).maybeSingle();
    if (existing?.status === "done") {
      await supabase.from("habit_completions").delete().eq("id", existing.id);
      revalidate();
      return { ok: true, data: { done: false } };
    }
    const { error } = await supabase.from("habit_completions").upsert({ habit_id: habitId, user_id: user.id, date, status: "done", value: value ?? null, completed_at: new Date().toISOString() }, { onConflict: "habit_id,date" });
    if (error) throw error;
    revalidate();
    revalidatePath(`/habitos/${habitId}`);
    return { ok: true, data: { done: true } };
  } catch (e) {
    return fail(e);
  }
}
