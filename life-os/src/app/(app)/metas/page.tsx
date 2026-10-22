import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { GoalsView } from "@/components/goals/goals-view";
import { getUserContext } from "@/lib/context";
import { loadGoals } from "@/lib/data/goals";
import { loadHabits } from "@/lib/data/habits";

export const metadata: Metadata = { title: "Metas" };

export default async function MetasPage() {
  const ctx = await getUserContext();
  const [goals, habits] = await Promise.all([loadGoals(ctx), loadHabits(ctx, { status: ["active"] })]);
  const rates = Object.fromEntries(habits.map((h) => [h.habit.id, h.monthRate]));
  return (
    <div className="space-y-6">
      <PageHeader title="Metas" description="Objetivos com progresso, prazo e hábitos relacionados." />
      <GoalsView goals={goals} habits={habits.map((h) => h.habit)} habitRates={rates} today={ctx.today} tz={ctx.tz} />
    </div>
  );
}
