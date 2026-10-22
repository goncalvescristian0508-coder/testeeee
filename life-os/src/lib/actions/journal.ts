"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext, fail, type ActionResult } from "@/lib/context";
import { isValidDateStr } from "@/lib/dates";

export const journalSchema = z.object({
  date: z.string().refine(isValidDateStr, "Data inválida."),
  content: z.string().trim().max(10000).optional().or(z.literal("")),
  mood: z.coerce.number().int().min(1).max(5).nullable().optional(),
  energy: z.coerce.number().int().min(1).max(5).nullable().optional(),
  good_things: z.string().trim().max(3000).optional().or(z.literal("")),
  improve: z.string().trim().max(3000).optional().or(z.literal("")),
  learnings: z.string().trim().max(3000).optional().or(z.literal("")),
  tomorrow_priorities: z.string().trim().max(3000).optional().or(z.literal("")),
});
export type JournalInput = z.input<typeof journalSchema>;

export async function saveJournalEntry(input: JournalInput): Promise<ActionResult> {
  try {
    const d = journalSchema.parse(input);
    const { supabase, user, today } = await requireContext();
    if (d.date > today) return { ok: false, error: "Não é possível escrever sobre dias futuros." };
    const { error } = await supabase.from("journal_entries").upsert(
      { user_id: user.id, date: d.date, content: d.content || null, mood: d.mood ?? null, energy: d.energy ?? null, good_things: d.good_things || null, improve: d.improve || null, learnings: d.learnings || null, tomorrow_priorities: d.tomorrow_priorities || null },
      { onConflict: "user_id,date" },
    );
    if (error) throw error;
    revalidatePath("/diario");
    revalidatePath("/estatisticas");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

export async function deleteJournalEntry(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("journal_entries").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidatePath("/diario");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
