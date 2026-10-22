import type { UserContext } from "@/lib/context";
import { expandOccurrences, type Occurrence, type OccurrenceSource } from "@/lib/recurrence";
import type { EventRow, RecurrenceExceptionRow, RecurrenceRuleRow } from "@/lib/database.types";

export interface EventSource extends OccurrenceSource, EventRow {
  rule: RecurrenceRuleRow | null;
  exceptions: RecurrenceExceptionRow[];
}

export type EventOccurrence = Occurrence<EventSource>;

/** Carrega eventos + regras + exceções e expande ocorrências no intervalo de datas locais. */
export async function loadOccurrences(ctx: UserContext, from: string, to: string): Promise<EventOccurrence[]> {
  const { supabase, user, tz } = ctx;
  const [{ data: events }, { data: rules }, { data: exceptions }] = await Promise.all([
    supabase.from("events").select("*").eq("user_id", user.id),
    supabase.from("recurrence_rules").select("*").eq("user_id", user.id),
    supabase.from("recurrence_exceptions").select("*").eq("user_id", user.id),
  ]);
  const ruleMap = new Map((rules ?? []).map((r) => [r.id, r]));
  const exByEvent = new Map<string, RecurrenceExceptionRow[]>();
  for (const ex of exceptions ?? []) exByEvent.set(ex.event_id, [...(exByEvent.get(ex.event_id) ?? []), ex]);
  const sources: EventSource[] = (events ?? []).map((e) => ({
    ...e,
    rule: e.recurrence_rule_id ? (ruleMap.get(e.recurrence_rule_id) ?? null) : null,
    exceptions: exByEvent.get(e.id) ?? [],
  }));
  return expandOccurrences(sources, from, to, tz);
}
