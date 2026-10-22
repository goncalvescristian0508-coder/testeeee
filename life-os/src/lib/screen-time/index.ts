/**
 * Tempo de tela — arquitetura desacoplada por fonte.
 *
 * source = 'manual'   : informado pelo usuário no site (única fonte hoje).
 * source = 'measured' : medido dentro do próprio site (sessões de foco são
 *                       registradas separadamente em focus_sessions).
 * source = 'imported' : reservado para um app nativo iOS (Screen Time API /
 *                       FamilyControls / DeviceActivity). Requer entitlement
 *                       da Apple, consentimento explícito e revisão de
 *                       privacidade antes de qualquer implementação. Nunca
 *                       tentar contornar restrições do iOS.
 *
 * Um provedor futuro implementa `ScreenTimeProvider` e grava linhas com
 * source='imported'; a UI já distingue as fontes.
 */
import type { ScreenTimeLogRow, ScreenTimeSource } from "@/lib/database.types";

export const APPS = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "games", label: "Jogos" },
  { key: "other", label: "Outros" },
] as const;

export type AppKey = (typeof APPS)[number]["key"];
export type Entries = Partial<Record<AppKey, number>>;

export interface ScreenTimeProvider {
  source: ScreenTimeSource;
  label: string;
  /** Busca minutos por app para uma data; null quando indisponível. */
  fetchDay(date: string): Promise<Entries | null>;
}

export const SOURCE_LABEL: Record<ScreenTimeSource, string> = {
  manual: "Informado manualmente",
  measured: "Medido neste site",
  imported: "Importado (integração)",
};

export function entriesOf(log: Pick<ScreenTimeLogRow, "entries">): Entries {
  const e = (log.entries ?? {}) as Record<string, unknown>;
  const out: Entries = {};
  for (const a of APPS) {
    const v = Number(e[a.key]);
    if (Number.isFinite(v) && v > 0) out[a.key] = Math.round(v);
  }
  return out;
}

export function totalOf(entries: Entries) {
  return Object.values(entries).reduce((a, b) => a + (b ?? 0), 0);
}

/** Dias com uso considerado excessivo: total acima da meta total (ou 180 min sem meta). */
export function isExcessive(total: number, goalTotal: number | null) {
  return total > (goalTotal ?? 180);
}

export function average(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}
