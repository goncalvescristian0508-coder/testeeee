import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { JournalView } from "@/components/journal/journal-view";
import { getUserContext } from "@/lib/context";
import { isValidDateStr } from "@/lib/dates";

export const metadata: Metadata = { title: "Diário" };

export default async function DiarioPage({ searchParams }: { searchParams: Promise<{ data?: string; q?: string }> }) {
  const sp = await searchParams;
  const ctx = await getUserContext();
  const date = sp.data && isValidDateStr(sp.data) && sp.data <= ctx.today ? sp.data : ctx.today;
  const q = (sp.q ?? "").trim().slice(0, 100);
  let query = ctx.supabase.from("journal_entries").select("*").eq("user_id", ctx.user.id).order("date", { ascending: false }).limit(60);
  if (q) query = query.textSearch("search", q, { type: "websearch", config: "portuguese" });
  const [{ data: entries }, { data: selected }] = await Promise.all([query, ctx.supabase.from("journal_entries").select("*").eq("user_id", ctx.user.id).eq("date", date).maybeSingle()]);
  return (
    <div className="space-y-6">
      <PageHeader title="Diário" description="Um espaço para fechar o dia e preparar o próximo." />
      <Suspense>
        <JournalView entries={entries ?? []} selected={selected ?? null} date={date} today={ctx.today} query={q} />
      </Suspense>
    </div>
  );
}
