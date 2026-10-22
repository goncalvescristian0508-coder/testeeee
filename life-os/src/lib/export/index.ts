/** Formato de exportação/importação (JSON). Versão 1. */
export const EXPORT_TABLES = [
  "categories",
  "habits",
  "habit_schedules",
  "habit_completions",
  "recurrence_rules",
  "tasks",
  "task_subtasks",
  "events",
  "recurrence_exceptions",
  "home_chores",
  "home_chore_items",
  "home_chore_logs",
  "sleep_goals",
  "sleep_logs",
  "focus_sessions",
  "screen_time_logs",
  "screen_time_goals",
  "personal_goals",
  "goal_progress",
  "journal_entries",
  "notification_preferences",
] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number];

export interface ExportFile {
  app: "life-os";
  version: 1;
  exported_at: string;
  profile: Record<string, unknown> | null;
  data: Partial<Record<ExportTable, Record<string, unknown>[]>>;
}

export function isExportFile(x: unknown): x is ExportFile {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return o.app === "life-os" && o.version === 1 && typeof o.data === "object" && o.data !== null;
}
