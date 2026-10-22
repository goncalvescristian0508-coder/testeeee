"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Aviso discreto quando a conexão cai. */
export function OnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full border border-warning/40 bg-popover px-3 py-1.5 text-xs text-warning shadow-lg animate-slide-up">
      <WifiOff className="size-3.5" />
      Sem conexão. Suas ações serão salvas quando a rede voltar a funcionar.
    </div>
  );
}
