import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ChoresView } from "@/components/home/chores-view";
import { getUserContext } from "@/lib/context";
import { loadChores } from "@/lib/data/home";

export const metadata: Metadata = { title: "Casa" };

export default async function CasaPage() {
  const ctx = await getUserContext();
  const chores = await loadChores(ctx);
  return (
    <div className="space-y-6">
      <PageHeader title="Casa" description="Faxina e tarefas domésticas com periodicidade própria." />
      <ChoresView chores={chores} today={ctx.today} tz={ctx.tz} weekStartsOn={ctx.weekStartsOn} />
    </div>
  );
}
