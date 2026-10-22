import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { HabitDetail } from "@/components/habits/habit-detail";
import { getUserContext } from "@/lib/context";
import { loadHabits } from "@/lib/data/habits";
import { loadCategories } from "@/lib/data/categories";

export const metadata: Metadata = { title: "Hábito" };

export default async function HabitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  const [items, categories] = await Promise.all([loadHabits(ctx), loadCategories(ctx)]);
  const item = items.find((i) => i.habit.id === id);
  if (!item) notFound();
  return <HabitDetail item={item} categories={categories.filter((c) => c.kind === "habit" || c.kind === "general")} today={ctx.today} />;
}
