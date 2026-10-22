"use client";

/**
 * Notificações locais (apenas com o site aberto). Não substituem Web Push:
 * em segundo plano ou com o navegador fechado elas NÃO disparam.
 */
export function localNotificationSupport(): "unsupported" | "denied" | "granted" | "default" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestLocalPermission() {
  if (localNotificationSupport() === "unsupported") return "unsupported" as const;
  return Notification.requestPermission();
}

export function showLocalNotification(title: string, body?: string) {
  if (localNotificationSupport() !== "granted") return false;
  try {
    const n = new Notification(title, { body, icon: "/icons/icon-192.png", tag: "life-os-focus" });
    setTimeout(() => n.close(), 8000);
    return true;
  } catch {
    return false;
  }
}

/** Beep curto via Web Audio (sem arquivo externo). */
export function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
    setTimeout(() => ctx.close(), 600);
  } catch {
    /* sem áudio */
  }
}
