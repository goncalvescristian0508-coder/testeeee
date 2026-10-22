import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pushConfigured, sendToUser } from "@/lib/push/server";

/** Envia uma notificação de teste para o próprio usuário. */
export async function POST() {
  if (!pushConfigured()) return NextResponse.json({ error: "Web Push não configurado no servidor (VAPID)." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const sent = await sendToUser(supabase, user.id, { title: "Life OS", body: "Notificações funcionando. Um dia de cada vez.", url: "/dashboard", tag: "test" });
  return NextResponse.json({ ok: true, sent });
}
