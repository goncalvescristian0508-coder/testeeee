import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { pushConfigured } from "@/lib/push/server";
import { runReminders } from "@/lib/push/reminders";

/**
 * Endpoint do agendador. Na Vercel, configurado em vercel.json (a cada 5 min);
 * em outros hosts, chame com `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ ok: false, reason: "VAPID não configurado" }, { status: 503 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: false, reason: "SUPABASE_SERVICE_ROLE_KEY ausente" }, { status: 503 });
  try {
    const result = await runReminders(createServiceClient());
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "erro" }, { status: 500 });
  }
}
