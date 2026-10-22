import { addDaysStr, weekdayOf } from "@/lib/dates";

/** Próxima data prevista: última realização + periodicidade, ajustada ao dia preferido. */
export function nextDueDate(lastDoneDate: string | null, everyDays: number, preferredWeekday: number | null, today: string): string {
  let due = lastDoneDate ? addDaysStr(lastDoneDate, Math.max(1, everyDays)) : today;
  if (preferredWeekday != null) {
    const diff = (preferredWeekday - weekdayOf(due) + 7) % 7;
    due = addDaysStr(due, diff);
  }
  return due;
}

export type ChoreState = "overdue" | "today" | "soon" | "later";

export function choreState(nextDue: string | null, today: string): ChoreState {
  if (!nextDue || nextDue < today) return "overdue";
  if (nextDue === today) return "today";
  const diff = (new Date(nextDue + "T12:00:00Z").getTime() - new Date(today + "T12:00:00Z").getTime()) / 86400000;
  return diff <= 3 ? "soon" : "later";
}
