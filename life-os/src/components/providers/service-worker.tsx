"use client";

import { useEffect } from "react";

/** Registra o service worker (cache de estáticos + recepção de push). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      /* sem suporte ou bloqueado: a aplicação funciona normalmente online */
    });
  }, []);
  return null;
}
