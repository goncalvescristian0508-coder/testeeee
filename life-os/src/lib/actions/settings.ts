"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireContext, fail, type ActionResult } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

const timeRe = /^\d{2}:\d{2}(:\d{2})?$/;

const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Informe seu nome.").max(60),
  timezone: z.string().min(3).max(60),
  week_starts_on: z.coerce.number().int().min(0).max(6),
  theme: z.enum(["dark", "light", "system"]),
  day_periods: z.object({ morning: z.string().regex(timeRe), afternoon: z.string().regex(timeRe), evening: z.string().regex(timeRe) }),
  dashboard_habit_ids: z.array(z.string().uuid()).default([]),
});
export type ProfileInput = z.input<typeof profileSchema>;

export async function saveProfile(input: ProfileInput): Promise<ActionResult> {
  try {
    const d = profileSchema.parse(input);
    try { Intl.DateTimeFormat(undefined, { timeZone: d.timezone }); } catch { return { ok: false, error: "Fuso horário inválido." }; }
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("profiles").update({ display_name: d.display_name, timezone: d.timezone, week_starts_on: d.week_starts_on, theme: d.theme, day_periods: d.day_periods, dashboard_habit_ids: d.dashboard_habit_ids }).eq("id", user.id);
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

const prefsSchema = z.object({
  habits: z.boolean(),
  events: z.boolean(),
  bedtime: z.boolean(),
  evening_routine: z.boolean(),
  morning_routine: z.boolean(),
  overdue_tasks: z.boolean(),
  overdue_tasks_time: z.string().regex(timeRe),
  quiet_start: z.string().regex(timeRe).nullable().or(z.literal("")),
  quiet_end: z.string().regex(timeRe).nullable().or(z.literal("")),
});
export type PrefsInput = z.input<typeof prefsSchema>;

export async function saveNotificationPreferences(input: PrefsInput): Promise<ActionResult> {
  try {
    const d = prefsSchema.parse(input);
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("notification_preferences").upsert({ user_id: user.id, ...d, quiet_start: d.quiet_start || null, quiet_end: d.quiet_end || null, updated_at: new Date().toISOString() });
    if (error) throw error;
    revalidatePath("/configuracoes");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

const categorySchema = z.object({ name: z.string().trim().min(1, "Nome obrigatório.").max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), kind: z.enum(["general", "habit", "event", "task", "home"]).default("general") });

export async function createCategory(input: z.input<typeof categorySchema>): Promise<ActionResult> {
  try {
    const d = categorySchema.parse(input);
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("categories").insert({ user_id: user.id, ...d });
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

export async function updateCategory(id: string, input: z.input<typeof categorySchema>): Promise<ActionResult> {
  try {
    const d = categorySchema.parse(input);
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("categories").update(d).eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("categories").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Apaga todos os dados (mantém a conta). */
export async function deleteAllData(confirmation: string): Promise<ActionResult> {
  try {
    if (confirmation !== "APAGAR") return { ok: false, error: "Digite APAGAR para confirmar." };
    const { supabase } = await requireContext();
    const { error } = await supabase.rpc("delete_my_data");
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Apaga a conta e todos os dados, depois encerra a sessão. */
export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  try {
    if (confirmation !== "EXCLUIR CONTA") return { ok: false, error: "Digite EXCLUIR CONTA para confirmar." };
    const { supabase } = await requireContext();
    const { error } = await supabase.rpc("delete_my_account");
    if (error) throw error;
  } catch (e) {
    return fail(e);
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
