/**
 * Tipos do banco (espelham supabase/migrations/0001_schema.sql).
 * Mantidos à mão para não depender da CLI durante o build; se alterar o
 * esquema, atualize aqui também (ou gere com `supabase gen types`).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Deriva Insert/Update a partir de Row, marcando como opcionais as colunas com default. */
type WithDefaults<Row, Optional extends keyof Row> = Omit<Row, Optional> & Partial<Pick<Row, Optional>>;

export type Period = "morning" | "afternoon" | "evening";
export type HabitKind = "boolean" | "quantity" | "duration";
export type HabitStatus = "active" | "paused" | "archived";
export type HabitFrequency = "daily" | "weekdays" | "times_per_week";
export type CompletionStatus = "done" | "skipped";
export type TaskStatus = "pending" | "done" | "cancelled";
export type EventKind = "event" | "meeting" | "appointment" | "personal" | "deadline" | "block" | "recurring";
export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";
export type FocusMode = "pomodoro" | "custom" | "stopwatch" | "social_free";
export type ScreenTimeSource = "manual" | "measured" | "imported";
export type GoalKind = "numeric" | "completion";
export type GoalStatus = "active" | "completed" | "archived";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  timezone: string;
  week_starts_on: number;
  theme: "dark" | "light" | "system";
  onboarding_completed: boolean;
  dashboard_habit_ids: string[];
  day_periods: Json;
  created_at: string;
  updated_at: string;
}

export type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  kind: "general" | "habit" | "event" | "task" | "home";
  sort_order: number;
  created_at: string;
}

export type HabitRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  category_id: string | null;
  kind: HabitKind;
  target_value: number | null;
  unit: string | null;
  recommended_time: string | null;
  estimated_minutes: number | null;
  period: Period | null;
  start_date: string;
  reminder_time: string | null;
  reminder_enabled: boolean;
  priority: number;
  status: HabitStatus;
  sort_order: number;
  show_on_dashboard: boolean;
  created_at: string;
  updated_at: string;
}

export type HabitScheduleRow = {
  id: string;
  habit_id: string;
  user_id: string;
  frequency: HabitFrequency;
  weekdays: number[];
  times_per_week: number | null;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
}

export type HabitCompletionRow = {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  status: CompletionStatus;
  value: number | null;
  note: string | null;
  completed_at: string;
}

export type RecurrenceRuleRow = {
  id: string;
  user_id: string;
  freq: RecurrenceFreq;
  interval: number;
  by_weekday: number[] | null;
  by_monthday: number | null;
  until: string | null;
  count: number | null;
  created_at: string;
}

export type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  period: Period | null;
  priority: number;
  category_id: string | null;
  estimated_minutes: number | null;
  status: TaskStatus;
  completed_at: string | null;
  is_priority: boolean;
  postponed_count: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type TaskSubtaskRow = {
  id: string;
  task_id: string;
  user_id: string;
  title: string;
  done: boolean;
  sort_order: number;
  created_at: string;
}

export type EventRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  kind: EventKind;
  start_at: string;
  end_at: string;
  all_day: boolean;
  category_id: string | null;
  priority: number;
  location: string | null;
  notify_minutes_before: number | null;
  notes: string | null;
  recurrence_rule_id: string | null;
  created_at: string;
  updated_at: string;
}

export type RecurrenceExceptionRow = {
  id: string;
  user_id: string;
  event_id: string;
  original_date: string;
  kind: "skip" | "moved";
  new_start_at: string | null;
  new_end_at: string | null;
  created_at: string;
}

export type HomeChoreRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  every_days: number;
  preferred_weekday: number | null;
  estimated_minutes: number | null;
  last_done_at: string | null;
  next_due_date: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type HomeChoreItemRow = {
  id: string;
  chore_id: string;
  user_id: string;
  title: string;
  done: boolean;
  sort_order: number;
}

export type HomeChoreLogRow = {
  id: string;
  chore_id: string;
  user_id: string;
  done_at: string;
  partial: boolean;
  items_done: number | null;
  items_total: number | null;
  duration_minutes: number | null;
  note: string | null;
}

export type SleepGoalRow = {
  user_id: string;
  bedtime: string;
  wake_time: string;
  target_hours: number;
  wind_down_minutes: number;
  evening_routine: Json;
  morning_routine: Json;
  updated_at: string;
}

export type SleepLogRow = {
  id: string;
  user_id: string;
  date: string;
  bed_at: string;
  asleep_at: string | null;
  wake_at: string;
  quality: number | null;
  awakenings: number | null;
  notes: string | null;
  created_at: string;
}

export type FocusSessionRow = {
  id: string;
  user_id: string;
  activity: string;
  goal: string | null;
  mode: FocusMode;
  planned_minutes: number | null;
  actual_seconds: number;
  started_at: string;
  ended_at: string | null;
  completed: boolean;
  interruptions: number;
  avoid_social: boolean;
  habit_id: string | null;
  note: string | null;
  client_id: string | null;
}

export type ScreenTimeLogRow = {
  id: string;
  user_id: string;
  date: string;
  source: ScreenTimeSource;
  entries: Json;
  total_minutes: number;
  conscious_use: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ScreenTimeGoalRow = {
  id: string;
  user_id: string;
  app: string;
  max_minutes: number;
}

export type PersonalGoalRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  kind: GoalKind;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  start_date: string;
  deadline: string | null;
  status: GoalStatus;
  related_habit_ids: string[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type GoalProgressRow = {
  id: string;
  goal_id: string;
  user_id: string;
  delta: number;
  value_after: number;
  note: string | null;
  created_at: string;
}

export type JournalEntryRow = {
  id: string;
  user_id: string;
  date: string;
  content: string | null;
  mood: number | null;
  energy: number | null;
  good_things: string | null;
  improve: string | null;
  learnings: string | null;
  tomorrow_priorities: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationPreferencesRow = {
  user_id: string;
  habits: boolean;
  events: boolean;
  bedtime: boolean;
  evening_routine: boolean;
  morning_routine: boolean;
  overdue_tasks: boolean;
  overdue_tasks_time: string;
  quiet_start: string | null;
  quiet_end: string | null;
  updated_at: string;
}

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
}

export type NotificationLogRow = {
  id: string;
  user_id: string;
  key: string;
  title: string;
  body: string | null;
  sent_at: string;
}

type Table<Row, Optional extends keyof Row> = {
  Row: Row;
  Insert: WithDefaults<Row, Optional>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "display_name" | "timezone" | "week_starts_on" | "theme" | "onboarding_completed" | "dashboard_habit_ids" | "day_periods" | "created_at" | "updated_at">;
      categories: Table<CategoryRow, "id" | "color" | "kind" | "sort_order" | "created_at">;
      habits: Table<HabitRow, "id" | "description" | "icon" | "color" | "category_id" | "kind" | "target_value" | "unit" | "recommended_time" | "estimated_minutes" | "period" | "start_date" | "reminder_time" | "reminder_enabled" | "priority" | "status" | "sort_order" | "show_on_dashboard" | "created_at" | "updated_at">;
      habit_schedules: Table<HabitScheduleRow, "id" | "frequency" | "weekdays" | "times_per_week" | "effective_from" | "effective_to" | "created_at">;
      habit_completions: Table<HabitCompletionRow, "id" | "status" | "value" | "note" | "completed_at">;
      recurrence_rules: Table<RecurrenceRuleRow, "id" | "interval" | "by_weekday" | "by_monthday" | "until" | "count" | "created_at">;
      tasks: Table<TaskRow, "id" | "description" | "due_date" | "due_time" | "period" | "priority" | "category_id" | "estimated_minutes" | "status" | "completed_at" | "is_priority" | "postponed_count" | "sort_order" | "created_at" | "updated_at">;
      task_subtasks: Table<TaskSubtaskRow, "id" | "done" | "sort_order" | "created_at">;
      events: Table<EventRow, "id" | "description" | "kind" | "all_day" | "category_id" | "priority" | "location" | "notify_minutes_before" | "notes" | "recurrence_rule_id" | "created_at" | "updated_at">;
      recurrence_exceptions: Table<RecurrenceExceptionRow, "id" | "new_start_at" | "new_end_at" | "created_at">;
      home_chores: Table<HomeChoreRow, "id" | "description" | "every_days" | "preferred_weekday" | "estimated_minutes" | "last_done_at" | "next_due_date" | "is_active" | "sort_order" | "created_at" | "updated_at">;
      home_chore_items: Table<HomeChoreItemRow, "id" | "done" | "sort_order">;
      home_chore_logs: Table<HomeChoreLogRow, "id" | "done_at" | "partial" | "items_done" | "items_total" | "duration_minutes" | "note">;
      sleep_goals: Table<SleepGoalRow, "bedtime" | "wake_time" | "target_hours" | "wind_down_minutes" | "evening_routine" | "morning_routine" | "updated_at">;
      sleep_logs: Table<SleepLogRow, "id" | "asleep_at" | "quality" | "awakenings" | "notes" | "created_at">;
      focus_sessions: Table<FocusSessionRow, "id" | "goal" | "mode" | "planned_minutes" | "actual_seconds" | "started_at" | "ended_at" | "completed" | "interruptions" | "avoid_social" | "habit_id" | "note" | "client_id">;
      screen_time_logs: Table<ScreenTimeLogRow, "id" | "source" | "entries" | "total_minutes" | "conscious_use" | "notes" | "created_at" | "updated_at">;
      screen_time_goals: Table<ScreenTimeGoalRow, "id">;
      personal_goals: Table<PersonalGoalRow, "id" | "description" | "kind" | "target_value" | "current_value" | "unit" | "start_date" | "deadline" | "status" | "related_habit_ids" | "completed_at" | "created_at" | "updated_at">;
      goal_progress: Table<GoalProgressRow, "id" | "delta" | "note" | "created_at">;
      journal_entries: Table<JournalEntryRow, "id" | "content" | "mood" | "energy" | "good_things" | "improve" | "learnings" | "tomorrow_priorities" | "created_at" | "updated_at">;
      notification_preferences: Table<NotificationPreferencesRow, "habits" | "events" | "bedtime" | "evening_routine" | "morning_routine" | "overdue_tasks" | "overdue_tasks_time" | "quiet_start" | "quiet_end" | "updated_at">;
      push_subscriptions: Table<PushSubscriptionRow, "id" | "user_agent" | "created_at" | "last_used_at">;
      notification_log: Table<NotificationLogRow, "id" | "body" | "sent_at">;
    };
    Views: Record<string, never>;
    Functions: {
      delete_my_data: { Args: Record<string, never>; Returns: undefined };
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
