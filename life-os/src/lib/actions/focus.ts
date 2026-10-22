"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext, fail, type ActionResult } from "@/lib/context";

const startSchema = z.object({
  client_id: z.string().min(8).max(64),
  activity: z.string().trim().min(1, "Diga o que vai fazer.").max(120),
  goal: z.string().trim().max(300).optional().or(z.literal("")),
  mode: z.enum(["pomodoro", "custom", "stopwatch", "social_free"]),
  planned_minutes: z.coerce.number().int().min(1).max(600).nullable().optional(),
  avoid_social: z.boolean().default(false),
  habit_id: z.string().uuid().nullable().optional(),
  started_at: z.string().datetime(),
});
export type StartFocusInput = z.input<typeof startSchema>;

const finishSchema = z.object({
  client_id: z.string().min(8).max(64),
  actual_seconds: z.coerce.number().int().min(0).max(86400),
  completed: z.boolean(),
  interruptions: z.coerce.number().int().min(0).max(500).default(0),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  ended_at: z.string().datetime(),
});
export type FinishFocusInput = z.input<typeof finishSchema>;

function revalidate() {
  revalidatePath("/foco");
  revalidatePath("/dashboard");
  revalidatePath("/estatisticas");
}

/** Cria a sessão no início (idempotente por client_id) para não perder dados se a aba fechar. */
export async function startFocusSession(input: StartFocusInput): Promise<ActionResult<{ id: string }>> {
  try {
    const d = startSchema.parse(input);
    const { supabase, user } = await requireContext();
    const { data, error } = await supabase
      .from("focus_sessions")
      .upsert(
        { user_id: user.id, client_id: d.client_id, activity: d.activity, goal: d.goal || null, mode: d.mode, planned_minutes: d.planned_minutes ?? null, avoid_social: d.avoid_social || d.mode === "social_free", habit_id: d.habit_id ?? null, started_at: d.started_at },
        { onConflict: "user_id,client_id" },
      )
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

/** Encerra (ou atualiza o progresso de) uma sessão. Idempotente. */
export async function finishFocusSession(input: FinishFocusInput): Promise<ActionResult> {
  try {
    const d = finishSchema.parse(input);
    const { supabase, user } = await requireContext();
    const { error } = await supabase
      .from("focus_sessions")
      .update({ actual_seconds: d.actual_seconds, completed: d.completed, interruptions: d.interruptions, note: d.note || null, ended_at: d.ended_at })
      .eq("user_id", user.id)
      .eq("client_id", d.client_id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

/** Salva progresso parcial (a cada minuto) sem revalidar páginas. */
export async function heartbeatFocusSession(clientId: string, actualSeconds: number, interruptions: number): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("focus_sessions").update({ actual_seconds: Math.max(0, Math.floor(actualSeconds)), interruptions }).eq("user_id", user.id).eq("client_id", clientId);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteFocusSession(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("focus_sessions").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
