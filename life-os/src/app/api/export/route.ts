import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EXPORT_TABLES, type ExportFile } from "@/lib/export";

/** Exporta todos os dados do usuário em JSON. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const out: ExportFile = { app: "life-os", version: 1, exported_at: new Date().toISOString(), profile: profile ? { display_name: profile.display_name, timezone: profile.timezone, week_starts_on: profile.week_starts_on, theme: profile.theme, day_periods: profile.day_periods } : null, data: {} };
  for (const t of EXPORT_TABLES) {
    const { data } = await supabase.from(t).select("*").eq("user_id", user.id);
    out.data[t] = (data ?? []) as Record<string, unknown>[];
  }
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="life-os-${out.exported_at.slice(0, 10)}.json"` },
  });
}
