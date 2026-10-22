"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = "loading" | "unsupported" | "needs_install" | "denied" | "subscribed" | "unsubscribed" | "no_vapid";

export function PushManager() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      if (!vapid) return setState("no_vapid");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
        return setState(isIOS && !standalone ? "needs_install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          // Garante que o servidor conhece esta assinatura (ex.: após troca de dispositivo/limpeza).
          await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) }).catch(() => {});
        }
        setState(sub ? "subscribed" : "unsubscribed");
      } catch {
        setState("unsupported");
      }
    })();
  }, [vapid]);

  const subscribe = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "unsubscribed");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid!) });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error("Falha ao salvar assinatura.");
      setState("subscribed");
      toast.success("Notificações ativadas neste dispositivo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ativar.");
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("unsubscribed");
      toast("Notificações desativadas neste dispositivo.");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Falha no envio.");
      toast.success(j.sent ? "Notificação de teste enviada." : "Nenhum dispositivo recebeu. Reative as notificações.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return <p className="text-sm text-muted-foreground">Verificando suporte…</p>;
  if (state === "no_vapid") return <Alert variant="warning"><Info /><AlertTitle>Web Push não configurado</AlertTitle><AlertDescription>Defina as chaves VAPID no servidor (veja o README). Até lá, só avisos com o site aberto funcionam.</AlertDescription></Alert>;
  if (state === "needs_install") return <Alert variant="info"><Info /><AlertTitle>No iPhone, instale o app primeiro</AlertTitle><AlertDescription>Safari › Compartilhar › “Adicionar à Tela de Início”. Depois abra o Life OS pelo ícone e volte aqui para ativar. Requer iOS 16.4 ou superior.</AlertDescription></Alert>;
  if (state === "unsupported") return <Alert variant="warning"><Info /><AlertTitle>Este navegador não suporta Web Push</AlertTitle><AlertDescription>Use Safari (iOS 16.4+, instalado na tela inicial), Chrome, Edge ou Firefox.</AlertDescription></Alert>;
  if (state === "denied") return <Alert variant="destructive"><BellOff /><AlertTitle>Permissão negada</AlertTitle><AlertDescription>Libere notificações para este site nas configurações do navegador/sistema e recarregue a página.</AlertDescription></Alert>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state === "subscribed" ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success"><BellRing className="size-3.5" /> Ativas neste dispositivo</span>
          <Button size="sm" variant="outline" onClick={test} loading={busy}>Enviar teste</Button>
          <Button size="sm" variant="ghost" onClick={unsubscribe} disabled={busy}>Desativar</Button>
        </>
      ) : (
        <Button size="sm" onClick={subscribe} loading={busy}><Bell /> Ativar notificações</Button>
      )}
    </div>
  );
}
