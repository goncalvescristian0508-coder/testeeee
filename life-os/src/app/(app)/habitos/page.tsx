import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { HabitsView } from "@/components/habits/habits-view";
import { getUserContext } from "@/lib/context";
import { loadHabits } from "@/lib/data/habits";
import { loadCategories } from "@/lib/data/categories";

export const metadata: Metadata = { title: "Hábitos" };

export default async function HabitosPage() {
  const ctx = await getUserContext();
  const [items, categories] = await Promise.all([loadHabits(ctx), loadCategories(ctx)]);
  return (
    <div className="space-y-6">
      <PageHeader title="Hábitos" description="Constância, não perfeição." />
      <HabitsView items={items} categories={categories.filter((c) => c.kind === "habit" || c.kind === "general")} today={ctx.today} periods={ctx.periods} />
    </div>
  );
}
