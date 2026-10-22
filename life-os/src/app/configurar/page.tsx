import { Settings2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ConfigurarPage() {
  if (isSupabaseConfigured()) redirect("/dashboard");
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-5 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
            <Settings2 className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Supabase não configurado</h1>
            <p className="text-sm text-muted-foreground">O Life OS precisa de um projeto Supabase para autenticação e dados.</p>
          </div>
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            Crie um projeto em <span className="font-mono">supabase.com</span>.
          </li>
          <li>
            Execute o arquivo <span className="font-mono">supabase/migrations/0001_schema.sql</span> no SQL Editor.
          </li>
          <li>
            Copie <span className="font-mono">.env.example</span> para <span className="font-mono">.env.local</span> e preencha{" "}
            <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> e <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>.
          </li>
          <li>Reinicie o servidor de desenvolvimento.</li>
        </ol>
        <p className="text-xs text-muted-foreground">O guia completo está no README do projeto.</p>
      </div>
    </main>
  );
}
