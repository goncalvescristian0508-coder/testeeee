import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function ensureVapid() {
  if (configured) return;
  if (!pushConfigured()) throw new Error("VAPID não configurado");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Envia para todas as assinaturas do usuário. Remove assinaturas expiradas (404/410).
 * Retorna quantas entregas foram aceitas pelo serviço de push.
 */
export async function sendToUser(supabase: SupabaseClient<Database>, userId: string, payload: PushPayload): Promise<number> {
  ensureVapid();
  const { data: subs } = await supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", userId);
  let sent = 0;
  for (const s of (subs ?? []) as Sub[]) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
      sent++;
      await supabase.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await supabase.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return sent;
}
