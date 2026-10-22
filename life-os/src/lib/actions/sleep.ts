"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext, fail, type ActionResult } from "@/lib/context";
import { addDaysStr, isValidDateStr, localToIso } from "@/lib/dates";

const timeRe = /^\d{2}:\d{2}(:\d{2})?$/;

export const sleepGoalSchema = z.object({
  bedtime: z.string().regex(timeRe),
  wake_time: z.string().regex(timeRe),
  target_hours: z.coerce.number().min(3).max(14),
  wind_down_minutes: z.coerce.number().int().min(0).max(240),
  evening_routine: z.array(z.object({ id: z.string(), title: z.string().trim().min(1).max(80) })).default([]),
  morning_routine: z.array(z.object({ id: z.string(), title: z.string().trim().min(1).max(80) })).default([]),
});
export type SleepGoalInput = z.input<typeof sleepGoalSchema>;

export const sleepLogSchema = z.object({
  date: z.string().refine(isValidDateStr, "Data inválida."), // dia em que acordou
  bed_time: z.string().regex(timeRe, "Hora de deitar inválida."),
  asleep_time: z.string().regex(timeRe).optional().or(z.literal("")),
  wake_time: z.string().regex(timeRe, "Hora de acordar inválida."),
  quality: z.coerce.number().int().min(1).max(5).nullable().optional(),
  awakenings: z.coerce.number().int().min(0).max(50).nullable().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type SleepLogInput = z.input<typeof sleepLogSchema>;

function revalidate() {
  revalidatePath("/sono");
  revalidatePath("/dashboard");
  revalidatePath("/estatisticas");
}

export async function saveSleepGoal(input: SleepGoalInput): Promise<ActionResult> {
  try {
    const d = sleepGoalSchema.parse(input);
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("sleep_goals").upsert({ user_id: user.id, bedtime: d.bedtime, wake_time: d.wake_time, target_hours: d.target_hours, wind_down_minutes: d.wind_down_minutes, evening_routine: d.evening_routine, morning_routine: d.morning_routine, updated_at: new Date().toISOString() });
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

/**
 * Registra uma noite de sono. "date" é o dia em que acordou; horários de deitar
 * anteriores ao de acordar são interpretados como pertencendo à noite anterior.
 */
export async function saveSleepLog(input: SleepLogInput): Promise<ActionResult> {
  try {
    const d = sleepLogSchema.parse(input);
    const { supabase, user, tz, today } = await requireContext();
    if (d.date > today) return { ok: false, error: "Não é possível registrar dias futuros." };
    const wakeIso = localToIso(d.date, d.wake_time, tz);
    // deitar: se a hora de deitar é maior que a de acordar, foi no dia anterior
    const bedDate = d.bed_time > d.wake_time ? addDaysStr(d.date, -1) : d.date;
    const bedIso = localToIso(bedDate, d.bed_time, tz);
    let asleepIso: string | null = null;
    if (d.asleep_time) {
      const asleepDate = d.asleep_time > d.wake_time ? addDaysStr(d.date, -1) : d.date;
      asleepIso = localToIso(asleepDate, d.asleep_time, tz);
      if (asleepIso < bedIso) asleepIso = bedIso;
    }
    if (new Date(wakeIso) <= new Date(bedIso)) return { ok: false, error: "A hora de acordar precisa ser depois da hora de deitar." };
    const hours = (new Date(wakeIso).getTime() - new Date(bedIso).getTime()) / 3600000;
    if (hours > 20) return { ok: false, error: "Tempo na cama maior que 20h. Verifique os horários." };
    const { error } = await supabase.from("sleep_logs").upsert(
      { user_id: user.id, date: d.date, bed_at: bedIso, asleep_at: asleepIso, wake_at: wakeIso, quality: d.quality ?? null, awakenings: d.awakenings ?? null, notes: d.notes || null },
      { onConflict: "user_id,date" },
    );
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

export async function deleteSleepLog(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("sleep_logs").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
