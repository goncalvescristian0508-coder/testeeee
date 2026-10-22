import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { addDaysStr, localToIso, nowTimeStr, timeToMinutes, todayStr, toDateStr, toTimeStr, weekdayOf } from "@/lib/dates";
import { expandOccurrences } from "@/lib/recurrence";
import { windDownTime } from "@/lib/sleep";
import { sendToUser, type PushPayload } from "./server";

/**
 * Lembretes agendados no servidor. Executado por cron (ex.: a cada 5 min).
 * Cada lembrete tem uma chave determinística gravada em notification_log,
 * então rodar o cron várias vezes nunca envia duplicatas.
 */
const WINDOW_MIN = 10; // tolerância: envia se o horário caiu nos últimos N minutos

interface Candidate {
  key: string;
  payload: PushPayload;
}

function withinWindow(targetHHMM: string, nowHHMM: string) {
  const diff = timeToMinutes(nowHHMM) - timeToMinutes(targetHHMM);
  return diff >= 0 && diff < WINDOW_MIN;
}

function inQuiet(prefs: { quiet_start: string | null; quiet_end: string | null }, nowHHMM: string) {
  if (!prefs.quiet_start || !prefs.quiet_end) return false;
  const n = timeToMinutes(nowHHMM), s = timeToMinutes(prefs.quiet_start), e = timeToMinutes(prefs.quiet_end);
  return s <= e ? n >= s && n < e : n >= s || n < e;
}

export async function collectReminders(supabase: SupabaseClient<Database>, userId: string, now: Date): Promise<Candidate[]> {
  const [{ data: profile }, { data: prefs }, { data: sleepGoal }] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", userId).single(),
    supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("sleep_goals").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (!prefs) return [];
  const tz = profile?.timezone || "America/Sao_Paulo";
  const today = todayStr(tz, now);
  const nowHHMM = nowTimeStr(tz, now);
  if (inQuiet(prefs, nowHHMM)) return [];
  const out: Candidate[] = [];

  if (prefs.habits) {
    const { data: habits } = await supabase.from("habits").select("id,name,reminder_time,reminder_enabled,start_date").eq("user_id", userId).eq("status", "active").eq("reminder_enabled", true).not("reminder_time", "is", null);
    const ids = (habits ?? []).map((h) => h.id);
    const [{ data: schedules }, { data: completions }] = ids.length
      ? await Promise.all([supabase.from("habit_schedules").select("*").in("habit_id", ids), supabase.from("habit_completions").select("habit_id").in("habit_id", ids).eq("date", today)])
      : [{ data: [] }, { data: [] }];
    const doneSet = new Set((completions ?? []).map((c) => c.habit_id));
    for (const h of habits ?? []) {
      if (!h.reminder_time || !withinWindow(h.reminder_time.slice(0, 5), nowHHMM) || doneSet.has(h.id) || today < h.start_date) continue;
      const sch = (schedules ?? []).filter((s) => s.habit_id === h.id && s.effective_from <= today && (!s.effective_to || s.effective_to >= today)).sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
      if (sch?.frequency === "weekdays" && !sch.weekdays.includes(weekdayOf(today))) continue;
      out.push({ key: `habit:${h.id}:${today}`, payload: { title: h.name, body: "Hora do seu hábito. Dois minutos já contam.", url: "/habitos", tag: `habit-${h.id}` } });
    }
  }

  if (prefs.events) {
    const { data: events } = await supabase.from("events").select("*").eq("user_id", userId).not("notify_minutes_before", "is", null);
    if (events?.length) {
      const [{ data: rules }, { data: exceptions }] = await Promise.all([supabase.from("recurrence_rules").select("*").eq("user_id", userId), supabase.from("recurrence_exceptions").select("*").eq("user_id", userId)]);
      const ruleMap = new Map((rules ?? []).map((r) => [r.id, r]));
      const sources = events.map((e) => ({ ...e, rule: e.recurrence_rule_id ? ruleMap.get(e.recurrence_rule_id) ?? null : null, exceptions: (exceptions ?? []).filter((x) => x.event_id === e.id) }));
      const occ = expandOccurrences(sources, addDaysStr(today, -1), addDaysStr(today, 2), tz);
      for (const o of occ) {
        const lead = o.source.notify_minutes_before ?? 0;
        const fireAt = new Date(new Date(o.start_at).getTime() - lead * 60000);
        const diffMin = (now.getTime() - fireAt.getTime()) / 60000;
        if (diffMin < 0 || diffMin >= WINDOW_MIN) continue;
        const when = toDateStr(o.start_at, tz) === today ? `hoje às ${toTimeStr(o.start_at, tz)}` : `amanhã às ${toTimeStr(o.start_at, tz)}`;
        out.push({ key: `event:${o.key}`, payload: { title: o.source.title, body: lead ? `Começa em ${lead} min (${when}).` : `Começa agora (${when}).`, url: `/agenda?view=dia&data=${toDateStr(o.start_at, tz)}`, tag: `event-${o.source.id}` } });
      }
    }
  }

  if (sleepGoal) {
    const bed = sleepGoal.bedtime.slice(0, 5);
    if (prefs.bedtime && withinWindow(bed, nowHHMM)) out.push({ key: `bedtime:${today}`, payload: { title: "Hora de dormir", body: `Seu horário planejado é ${bed}. Amanhã agradece.`, url: "/sono", tag: "bedtime" } });
    if (prefs.evening_routine && sleepGoal.wind_down_minutes > 0 && withinWindow(windDownTime(bed, sleepGoal.wind_down_minutes), nowHHMM)) out.push({ key: `winddown:${today}`, payload: { title: "Começar a desacelerar", body: `Rotina noturna: ${sleepGoal.wind_down_minutes} min antes de dormir.`, url: "/sono", tag: "winddown" } });
    if (prefs.morning_routine && withinWindow(sleepGoal.wake_time.slice(0, 5), nowHHMM)) out.push({ key: `morning:${today}`, payload: { title: "Bom dia", body: "Rotina matinal e prioridades do dia te esperam.", url: "/dashboard", tag: "morning" } });
  }

  if (prefs.overdue_tasks && withinWindow(prefs.overdue_tasks_time.slice(0, 5), nowHHMM)) {
    const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending").lt("due_date", today);
    const { count: chores } = await supabase.from("home_chores").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_active", true).lt("next_due_date", today);
    const total = (count ?? 0) + (chores ?? 0);
    if (total > 0) out.push({ key: `overdue:${today}`, payload: { title: `${total} pendência${total > 1 ? "s" : ""} atrasada${total > 1 ? "s" : ""}`, body: "Sem pressa: escolha uma e resolva hoje.", url: "/tarefas", tag: "overdue" } });
  }

  void localToIso;
  return out;
}

/** Processa todos os usuários com assinaturas. Retorna total enviado. */
export async function runReminders(supabase: SupabaseClient<Database>, now = new Date()) {
  const { data: users } = await supabase.from("push_subscriptions").select("user_id");
  const ids = [...new Set((users ?? []).map((u) => u.user_id))];
  let sent = 0, skipped = 0;
  for (const userId of ids) {
    const candidates = await collectReminders(supabase, userId, now);
    for (const c of candidates) {
      // Reserva a chave antes de enviar: se já existir, outro processo cuidou.
      const { error } = await supabase.from("notification_log").insert({ user_id: userId, key: c.key, title: c.payload.title, body: c.payload.body ?? null });
      if (error) { skipped++; continue; }
      sent += await sendToUser(supabase, userId, c.payload);
    }
  }
  return { users: ids.length, sent, skipped };
}
