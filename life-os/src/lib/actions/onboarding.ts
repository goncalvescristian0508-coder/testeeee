"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireContext, fail, type ActionResult } from "@/lib/context";

const schema = z.object({
  display_name: z.string().trim().min(1, "Informe seu nome.").max(60),
  bedtime: z.string().regex(/^\d{2}:\d{2}$/),
  wake_time: z.string().regex(/^\d{2}:\d{2}$/),
  target_hours: z.coerce.number().min(4).max(12),
  habits: z.array(
    z.object({
      name: z.string().trim().min(1).max(80),
      icon: z.string().max(30),
      color: z.string(),
      period: z.enum(["morning", "afternoon", "evening"]),
      time: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")),
      kind: z.enum(["boolean", "quantity", "duration"]),
      target: z.number().positive().nullable().optional(),
      unit: z.string().max(20).nullable().optional(),
      minutes: z.number().int().min(0).nullable().optional(),
    }),
  ),
});

export type OnboardingInput = z.input<typeof schema>;

export async function completeOnboarding(input: OnboardingInput): Promise<ActionResult> {
  try {
    const data = schema.parse(input);
    const { supabase, user, today } = await requireContext();

    const { error: pe } = await supabase.from("profiles").update({ display_name: data.display_name, onboarding_completed: true }).eq("id", user.id);
    if (pe) throw pe;
    const { error: se } = await supabase.from("sleep_goals").upsert({ user_id: user.id, bedtime: data.bedtime, wake_time: data.wake_time, target_hours: data.target_hours, wind_down_minutes: 30 });
    if (se) throw se;

    if (data.habits.length) {
      const { count } = await supabase.from("habits").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      const base = count ?? 0;
      const { data: created, error: he } = await supabase
        .from("habits")
        .insert(
          data.habits.map((h, i) => ({
            user_id: user.id,
            name: h.name,
            icon: h.icon,
            color: h.color,
            kind: h.kind,
            target_value: h.kind === "boolean" ? null : (h.target ?? null),
            unit: h.kind === "quantity" ? (h.unit ?? null) : h.kind === "duration" ? "min" : null,
            period: h.period,
            recommended_time: h.time || null,
            estimated_minutes: h.minutes ?? null,
            start_date: today,
            sort_order: base + i,
          })),
        )
        .select("id");
      if (he) throw he;
      const { error: sche } = await supabase.from("habit_schedules").insert((created ?? []).map((c) => ({ habit_id: c.id, user_id: user.id, frequency: "daily" as const, weekdays: [0, 1, 2, 3, 4, 5, 6], effective_from: today })));
      if (sche) throw sche;
    }

    // Categorias iniciais (editáveis em Configurações)
    const { count: catCount } = await supabase.from("categories").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    if (!catCount) {
      await supabase.from("categories").insert([
        { user_id: user.id, name: "Saúde", color: "#22c55e", kind: "general", sort_order: 0 },
        { user_id: user.id, name: "Trabalho", color: "#818cf8", kind: "general", sort_order: 1 },
        { user_id: user.id, name: "Casa", color: "#f59e0b", kind: "general", sort_order: 2 },
        { user_id: user.id, name: "Pessoal", color: "#38bdf8", kind: "general", sort_order: 3 },
        { user_id: user.id, name: "Estudos", color: "#a78bfa", kind: "general", sort_order: 4 },
      ]);
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

export async function skipOnboarding() {
  const { supabase, user } = await requireContext();
  await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
