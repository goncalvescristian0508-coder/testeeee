"use client";

/**
 * Store externo da sessão de foco ativa, persistido em localStorage.
 * Usado via useSyncExternalStore: sobrevive a recarregamentos e evita
 * sincronizar estado React a partir de efeitos.
 */
export type FocusMode = "pomodoro" | "custom" | "stopwatch" | "social_free";
export type FocusPhase = "focus" | "short" | "long" | "done";

export interface ActiveFocus {
  clientId: string;
  activity: string;
  goal: string;
  mode: FocusMode;
  plannedMinutes: number | null;
  avoidSocial: boolean;
  habitId: string | null;
  startedAt: number;
  elapsedBefore: number; // segundos acumulados na fase atual antes da pausa
  runningSince: number | null; // epoch ms; null = pausado
  focusAccumulated: number; // segundos de foco de fases já encerradas
  interruptions: number;
  cycle: number;
  phase: FocusPhase;
  phaseSeconds: number;
}

const KEY = "lifeos:focus:active";
const listeners = new Set<() => void>();
let cache: ActiveFocus | null | undefined; // undefined = ainda não lido

function read(): ActiveFocus | null {
  if (cache !== undefined) return cache;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    cache = raw ? (JSON.parse(raw) as ActiveFocus) : null;
  } catch {
    cache = null;
  }
  return cache;
}

function emit() {
  for (const l of listeners) l();
}

export const focusStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        cache = undefined;
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
  get: (): ActiveFocus | null => read(),
  getServer: (): ActiveFocus | null => null,
  set(next: ActiveFocus | null) {
    cache = next;
    try {
      if (next) localStorage.setItem(KEY, JSON.stringify(next));
      else localStorage.removeItem(KEY);
    } catch {
      /* armazenamento indisponível: a sessão segue só em memória */
    }
    emit();
  },
  update(fn: (a: ActiveFocus) => ActiveFocus) {
    const cur = read();
    if (cur) focusStore.set(fn(cur));
  },
};

/** Relógio compartilhado (tick a cada 250ms enquanto houver assinantes). */
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;
let now = 0;
export const clockStore = {
  subscribe(listener: () => void) {
    clockListeners.add(listener);
    if (!clockTimer) clockTimer = setInterval(() => { now = Date.now(); for (const l of clockListeners) l(); }, 250);
    return () => {
      clockListeners.delete(listener);
      if (!clockListeners.size && clockTimer) { clearInterval(clockTimer); clockTimer = null; }
    };
  },
  get: () => now || Date.now(),
  getServer: () => 0,
};

/** Permissão de notificação como store (re-lida após solicitar). */
const permListeners = new Set<() => void>();
export const permissionStore = {
  subscribe(l: () => void) { permListeners.add(l); return () => { permListeners.delete(l); }; },
  get: (): "unsupported" | "denied" | "granted" | "default" => (typeof window === "undefined" || !("Notification" in window) ? "unsupported" : Notification.permission),
  getServer: () => "default" as const,
  refresh() { for (const l of permListeners) l(); },
};
