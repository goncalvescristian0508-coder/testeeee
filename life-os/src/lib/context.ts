import { redirect } from "next/navigation";
import { createClient, getProfile, getUser } from "@/lib/supabase/server";
import { DEFAULT_PERIODS, DEFAULT_TZ, todayStr, type DayPeriods } from "@/lib/dates";
import type { ProfileRow } from "@/lib/database.types";

export interface UserContext {
  user: NonNullable<Awaited<ReturnType<typeof getUser>>>;
  profile: ProfileRow;
  tz: string;
  today: string;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  periods: DayPeriods;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/** Contexto do usuário autenticado para páginas e actions. Redireciona se não logado. */
export async function getUserContext(): Promise<UserContext> {
  const user = await getUser();
  if (!user) redirect("/login");
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const tz = profile.timezone || DEFAULT_TZ;
  const supabase = await createClient();
  const periods = { ...DEFAULT_PERIODS, ...((profile.day_periods as Partial<DayPeriods>) ?? {}) };
  return {
    user,
    profile,
    tz,
    today: todayStr(tz),
    weekStartsOn: (profile.week_starts_on ?? 1) as UserContext["weekStartsOn"],
    periods,
    supabase,
  };
}

/** Variante para actions: lança erro em vez de redirecionar. */
export async function requireContext(): Promise<UserContext> {
  const user = await getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  const profile = await getProfile();
  if (!profile) throw new Error("Perfil não encontrado.");
  const tz = profile.timezone || DEFAULT_TZ;
  const supabase = await createClient();
  const periods = { ...DEFAULT_PERIODS, ...((profile.day_periods as Partial<DayPeriods>) ?? {}) };
  return { user, profile, tz, today: todayStr(tz), weekStartsOn: (profile.week_starts_on ?? 1) as UserContext["weekStartsOn"], periods, supabase };
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export function fail(error: unknown): { ok: false; error: string } {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Erro inesperado.";
  return { ok: false, error: message };
}
