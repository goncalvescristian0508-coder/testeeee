"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext, fail, type ActionResult } from "@/lib/context";
import { isValidDateStr, localToIso, toDateStr, toTimeStr } from "@/lib/dates";

const timeRe = /^\d{2}:\d{2}(:\d{2})?$/;

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Dê um título ao compromisso.").max(120),
    description: z.string().trim().max(1000).optional().or(z.literal("")),
    kind: z.enum(["event", "meeting", "appointment", "personal", "deadline", "block", "recurring"]).default("event"),
    date: z.string().refine(isValidDateStr, "Data inválida."),
    start_time: z.string().regex(timeRe, "Hora inicial inválida."),
    end_time: z.string().regex(timeRe, "Hora final inválida."),
    all_day: z.boolean().default(false),
    category_id: z.string().uuid().nullable().optional(),
    priority: z.coerce.number().int().min(1).max(3).default(2),
    location: z.string().trim().max(200).optional().or(z.literal("")),
    notify_minutes_before: z.coerce.number().int().min(0).max(10080).nullable().optional(),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
    recurrence: z
      .object({
        freq: z.enum(["none", "daily", "weekly", "monthly", "yearly"]).default("none"),
        interval: z.coerce.number().int().min(1).max(365).default(1),
        by_weekday: z.array(z.number().int().min(0).max(6)).optional(),
        by_monthday: z.coerce.number().int().min(1).max(31).nullable().optional(),
        until: z.string().refine((s) => !s || isValidDateStr(s), "Data inválida.").optional().or(z.literal("")),
        count: z.coerce.number().int().min(1).max(1000).nullable().optional(),
      })
      .default({ freq: "none", interval: 1 }),
  })
  .refine((d) => d.all_day || d.end_time > d.start_time, { message: "A hora final deve ser depois da inicial.", path: ["end_time"] });

export type EventInput = z.input<typeof eventSchema>;

function revalidate() {
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
}

async function upsertRule(supabase: Awaited<ReturnType<typeof requireContext>>["supabase"], userId: string, rec: z.output<typeof eventSchema>["recurrence"], existingId: string | null) {
  if (rec.freq === "none") {
    if (existingId) await supabase.from("recurrence_rules").delete().eq("id", existingId);
    return null;
  }
  const payload = {
    user_id: userId,
    freq: rec.freq,
    interval: rec.interval,
    by_weekday: rec.freq === "weekly" ? rec.by_weekday ?? null : null,
    by_monthday: rec.freq === "monthly" ? rec.by_monthday ?? null : null,
    until: rec.until || null,
    count: rec.count ?? null,
  };
  if (existingId) {
    const { error } = await supabase.from("recurrence_rules").update(payload).eq("id", existingId);
    if (error) throw error;
    return existingId;
  }
  const { data, error } = await supabase.from("recurrence_rules").insert(payload).select("id").single();
  if (error) throw error;
  return data.id;
}

function toRow(d: z.output<typeof eventSchema>, tz: string) {
  const start = d.all_day ? localToIso(d.date, "00:00", tz) : localToIso(d.date, d.start_time, tz);
  const end = d.all_day ? localToIso(d.date, "23:59", tz) : localToIso(d.date, d.end_time, tz);
  return {
    title: d.title,
    description: d.description || null,
    kind: d.recurrence.freq !== "none" && d.kind === "event" ? ("recurring" as const) : d.kind,
    start_at: start,
    end_at: end,
    all_day: d.all_day,
    category_id: d.category_id ?? null,
    priority: d.priority,
    location: d.location || null,
    notify_minutes_before: d.notify_minutes_before ?? null,
    notes: d.notes || null,
  };
}

export async function createEvent(input: EventInput): Promise<ActionResult<{ id: string }>> {
  try {
    const data = eventSchema.parse(input);
    const { supabase, user, tz } = await requireContext();
    const ruleId = await upsertRule(supabase, user.id, data.recurrence, null);
    const { data: ev, error } = await supabase.from("events").insert({ ...toRow(data, tz), user_id: user.id, recurrence_rule_id: ruleId }).select("id").single();
    if (error) throw error;
    revalidate();
    return { ok: true, data: { id: ev.id } };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

export async function updateEvent(id: string, input: EventInput): Promise<ActionResult> {
  try {
    const data = eventSchema.parse(input);
    const { supabase, user, tz } = await requireContext();
    const { data: existing } = await supabase.from("events").select("recurrence_rule_id").eq("id", id).eq("user_id", user.id).single();
    const ruleId = await upsertRule(supabase, user.id, data.recurrence, existing?.recurrence_rule_id ?? null);
    const { error } = await supabase.from("events").update({ ...toRow(data, tz), recurrence_rule_id: ruleId }).eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e instanceof z.ZodError ? e.issues[0].message : e);
  }
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { data: ev } = await supabase.from("events").select("recurrence_rule_id").eq("id", id).eq("user_id", user.id).single();
    const { error } = await supabase.from("events").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    if (ev?.recurrence_rule_id) await supabase.from("recurrence_rules").delete().eq("id", ev.recurrence_rule_id);
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Cancela apenas uma ocorrência de um evento recorrente. */
export async function skipOccurrence(eventId: string, originalDate: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("recurrence_exceptions").upsert({ user_id: user.id, event_id: eventId, original_date: originalDate, kind: "skip", new_start_at: null, new_end_at: null }, { onConflict: "event_id,original_date" });
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Remarca uma ocorrência (ou o evento inteiro, se não for recorrente). Usado pelo arrastar-e-soltar. */
export async function moveOccurrence(eventId: string, originalDate: string, newStartIso: string, newEndIso: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { data: ev } = await supabase.from("events").select("recurrence_rule_id").eq("id", eventId).eq("user_id", user.id).single();
    if (!ev) throw new Error("Evento não encontrado.");
    if (new Date(newEndIso) <= new Date(newStartIso)) throw new Error("Horário inválido.");
    if (!ev.recurrence_rule_id) {
      const { error } = await supabase.from("events").update({ start_at: newStartIso, end_at: newEndIso }).eq("id", eventId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("recurrence_exceptions").upsert({ user_id: user.id, event_id: eventId, original_date: originalDate, kind: "moved", new_start_at: newStartIso, new_end_at: newEndIso }, { onConflict: "event_id,original_date" });
      if (error) throw error;
    }
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Remove a exceção (restaura a ocorrência original). */
export async function restoreOccurrence(eventId: string, originalDate: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireContext();
    const { error } = await supabase.from("recurrence_exceptions").delete().eq("event_id", eventId).eq("original_date", originalDate).eq("user_id", user.id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Encerra a recorrência a partir de uma data (edições "deste em diante"). */
export async function endRecurrenceBefore(eventId: string, date: string): Promise<ActionResult> {
  try {
    const { supabase, user, tz } = await requireContext();
    const { data: ev } = await supabase.from("events").select("recurrence_rule_id,start_at,end_at").eq("id", eventId).eq("user_id", user.id).single();
    if (!ev?.recurrence_rule_id) throw new Error("Evento não é recorrente.");
    const prev = new Date(date + "T12:00:00Z");
    prev.setUTCDate(prev.getUTCDate() - 1);
    const until = prev.toISOString().slice(0, 10);
    if (until < toDateStr(ev.start_at, tz)) return deleteEvent(eventId);
    const { error } = await supabase.from("recurrence_rules").update({ until }).eq("id", ev.recurrence_rule_id);
    if (error) throw error;
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function eventDefaultsFromOccurrence(startIso: string, endIso: string, tz: string) {
  return { date: toDateStr(startIso, tz), start_time: toTimeStr(startIso, tz), end_time: toTimeStr(endIso, tz) };
}
