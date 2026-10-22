"use client";

import { useState } from "react";
import { CalendarPlus, ListPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "@/components/tasks/task-form";
import { EventFormDialog } from "@/components/events/event-form";
import { HabitFormDialog } from "@/components/habits/habit-form";
import type { CategoryRow } from "@/lib/database.types";

export function QuickActions({ categories, today, tz }: { categories: CategoryRow[]; today: string; tz: string }) {
  const [task, setTask] = useState(false);
  const [event, setEvent] = useState(false);
  const [habit, setHabit] = useState(false);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setTask(true)}><Plus /> Tarefa</Button>
        <Button variant="outline" size="sm" onClick={() => setEvent(true)}><CalendarPlus /> Compromisso</Button>
        <Button variant="outline" size="sm" onClick={() => setHabit(true)}><ListPlus /> Hábito</Button>
      </div>
      <TaskFormDialog open={task} onOpenChange={setTask} categories={categories} today={today} />
      <EventFormDialog open={event} onOpenChange={setEvent} categories={categories} today={today} tz={tz} />
      <HabitFormDialog open={habit} onOpenChange={setHabit} categories={categories} today={today} />
    </>
  );
}
