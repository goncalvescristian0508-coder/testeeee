"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext, fail, type ActionResult } from "@/lib/context";
import { isValidDateStr } from "@/lib/dates";
import { APPS } from "@/lib/screen-time";

const appKeys = APPS.map((a) => a.key) as [string, ...string[]];

const logSchema = z.object({
  date: z.string().refine(isValidDateStr, "Data inválida."),
  entries: z.record(z.enum(appKeys), z.coerce.number().min(0).max(1440)),
  conscious_use: z.boolean().default(false),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type ScreenTimeLogInput = z.input<typeof logSchema>;

const goalsSchema = z.array(z.object({ app: z.enum([...appKeys, "total"]), max_minutes: z.coerce.number().int().min(0).max(1440) }));

function revalidate() {
  revalidatePath("/bem-estar-digital");
  revalidatePath("/dashboard");
  revalidatePath("/estatisticas");
}

/** Registro manual do dia (uma linha por usuário/dia/fonte). */
export async function saveScreenTimeLog(input: ScreenTimeLogInput): Promise<ActionResult> {
  try {
    const d = logSchema.parse(input);
    const { supabase, user, today } = await requireContext();
    if (d.date > today) return { ok: false, error: "Não é possível registrar dias futuros." };
    const entries = Object.fromEntries(Object.entries(d.entries).filter(([, v]) => v > 0).map(([k, v]) => [k, Math.round(v)]));
    const total = Object.values(entries).reduce((a, b) => a + b, 0);
    if (total > 1440) return { ok: false, error: "O total ultrapassa 24 horas." };
    const { error } = await supabase.from("screen_time_logs").upsert({ user_id: user.id, date: d.date, source: "manual", entries, total_minutes: total, conscious_use: d.conscious_use, notes: d.notes || null }, { onConflict: "user_id,date,source" });
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

export async function deleteScreenTimeLog(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("screen_time_logs").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveScreenTimeGoals(input: z.input<typeof goalsSchema>): Promise<ActionResult> {
  try {
    const goals = goalsSchema.parse(input);
    const { supabase, user } = await requireContext();
    const toUpsert = goals.filter((g) => g.max_minutes > 0).map((g) => ({ user_id: user.id, app: g.app, max_minutes: g.max_minutes }));
    const toDelete = goals.filter((g) => g.max_minutes === 0).map((g) => g.app);
    if (toUpsert.length) {
      const { error } = await supabase.from("screen_time_goals").upsert(toUpsert, { onConflict: "user_id,app" });
      if (error) throw error;
    }
    if (toDelete.length) await supabase.from("screen_time_goals").delete().eq("user_id", user.id).in("app", toDelete);
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}
