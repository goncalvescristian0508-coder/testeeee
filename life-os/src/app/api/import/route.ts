import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EXPORT_TABLES, isExportFile } from "@/lib/export";

/**
 * Importa um arquivo exportado pelo Life OS. Os registros mantêm seus ids
 * (upsert), então importar o mesmo arquivo duas vezes não duplica nada.
 * Tabelas são processadas em ordem de dependência (pais antes de filhos).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!isExportFile(body)) return NextResponse.json({ error: "Arquivo inválido: esperado um export do Life OS (versão 1)." }, { status: 400 });

  const counts: Record<string, number> = {};
  const errors: string[] = [];
  for (const t of EXPORT_TABLES) {
    const rows = body.data[t];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const cleaned = rows.map((r) => ({ ...r, user_id: user.id }));
    const conflict = t === "sleep_goals" || t === "notification_preferences" ? "user_id" : "id";
    for (let i = 0; i < cleaned.length; i += 200) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from(t) as any).upsert(cleaned.slice(i, i + 200), { onConflict: conflict });
      if (error) {
        errors.push(`${t}: ${error.message}`);
        break;
      }
      counts[t] = (counts[t] ?? 0) + Math.min(200, cleaned.length - i);
    }
  }
  if (body.profile && typeof body.profile === "object") {
    const p = body.profile as Record<string, unknown>;
    await supabase.from("profiles").update({ display_name: (p.display_name as string) ?? null, timezone: (p.timezone as string) ?? "America/Sao_Paulo", week_starts_on: (p.week_starts_on as number) ?? 1 }).eq("id", user.id);
  }
  return NextResponse.json({ ok: errors.length === 0, counts, errors });
}
