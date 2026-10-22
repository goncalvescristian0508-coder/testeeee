-- =============================================================================
-- Life OS — esquema inicial
-- Todas as tabelas pertencem a um usuário (user_id = auth.uid()) e são
-- protegidas por RLS. Operações críticas usam chaves únicas para serem
-- idempotentes (ex.: uma conclusão por hábito por dia).
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------- utilitários ------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- profiles ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Sao_Paulo',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6), -- 0=domingo, 1=segunda
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  onboarding_completed boolean not null default false,
  dashboard_habit_ids uuid[] not null default '{}',
  day_periods jsonb not null default '{"morning":"05:00","afternoon":"12:00","evening":"18:00"}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- cria o perfil + preferências automaticamente ao registrar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.notification_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.sleep_goals (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

-- ---------- categories -------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#22c55e',
  kind text not null default 'general' check (kind in ('general','habit','event','task','home')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists categories_user_idx on public.categories(user_id);
alter table public.categories enable row level security;
create policy "categories_all_own" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- habits -----------------------------------------------------------
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  icon text not null default 'check',
  color text not null default '#22c55e',
  category_id uuid references public.categories(id) on delete set null,
  kind text not null default 'boolean' check (kind in ('boolean','quantity','duration')),
  target_value numeric,                 -- ex.: 10 páginas ou 15 minutos
  unit text,                            -- ex.: 'páginas', 'copos', 'min'
  recommended_time time,
  estimated_minutes int,
  period text check (period in ('morning','afternoon','evening')),
  start_date date not null default current_date,
  reminder_time time,
  reminder_enabled boolean not null default false,
  priority smallint not null default 2 check (priority between 1 and 3), -- 1 alta, 2 média, 3 baixa
  status text not null default 'active' check (status in ('active','paused','archived')),
  sort_order int not null default 0,
  show_on_dashboard boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists habits_user_status_idx on public.habits(user_id, status);
alter table public.habits enable row level security;
create policy "habits_all_own" on public.habits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger habits_updated_at before update on public.habits for each row execute function public.set_updated_at();

-- Histórico de agendamento: permite saber se o hábito estava programado em
-- determinado dia, mesmo depois de alterar a frequência.
create table if not exists public.habit_schedules (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  frequency text not null default 'daily' check (frequency in ('daily','weekdays','times_per_week')),
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}', -- 0=domingo … 6=sábado
  times_per_week smallint,
  effective_from date not null default current_date,
  effective_to date,                     -- null = vigente
  created_at timestamptz not null default now()
);
create index if not exists habit_schedules_habit_idx on public.habit_schedules(habit_id, effective_from);
alter table public.habit_schedules enable row level security;
create policy "habit_schedules_all_own" on public.habit_schedules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  status text not null default 'done' check (status in ('done','skipped')),
  value numeric,                        -- quantidade/duração registrada
  note text,
  completed_at timestamptz not null default now(),
  unique (habit_id, date)               -- idempotência: uma linha por hábito/dia
);
create index if not exists habit_completions_user_date_idx on public.habit_completions(user_id, date);
alter table public.habit_completions enable row level security;
create policy "habit_completions_all_own" on public.habit_completions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- recurrence ---------------------------------------------------------
create table if not exists public.recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  freq text not null check (freq in ('daily','weekly','monthly','yearly')),
  interval int not null default 1 check (interval >= 1),
  by_weekday smallint[],                 -- weekly: dias da semana
  by_monthday smallint,                  -- monthly: dia do mês
  until date,
  count int,
  created_at timestamptz not null default now()
);
alter table public.recurrence_rules enable row level security;
create policy "recurrence_rules_all_own" on public.recurrence_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- tasks ------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  due_time time,
  period text check (period in ('morning','afternoon','evening')),
  priority smallint not null default 2 check (priority between 1 and 3),
  category_id uuid references public.categories(id) on delete set null,
  estimated_minutes int,
  status text not null default 'pending' check (status in ('pending','done','cancelled')),
  completed_at timestamptz,
  is_priority boolean not null default false,  -- "prioridade do dia"
  postponed_count int not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_user_due_idx on public.tasks(user_id, due_date);
create index if not exists tasks_user_status_idx on public.tasks(user_id, status);
alter table public.tasks enable row level security;
create policy "tasks_all_own" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();

create table if not exists public.task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists task_subtasks_task_idx on public.task_subtasks(task_id);
alter table public.task_subtasks enable row level security;
create policy "task_subtasks_all_own" on public.task_subtasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- events -----------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  kind text not null default 'event' check (kind in ('event','meeting','appointment','personal','deadline','block','recurring')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  category_id uuid references public.categories(id) on delete set null,
  priority smallint not null default 2 check (priority between 1 and 3),
  location text,
  notify_minutes_before int,             -- null = sem notificação
  notes text,
  recurrence_rule_id uuid references public.recurrence_rules(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at >= start_at)
);
create index if not exists events_user_start_idx on public.events(user_id, start_at);
alter table public.events enable row level security;
create policy "events_all_own" on public.events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger events_updated_at before update on public.events for each row execute function public.set_updated_at();

-- Exceções: ocorrência cancelada ou remarcada de um evento recorrente.
create table if not exists public.recurrence_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  original_date date not null,           -- data (no fuso do usuário) da ocorrência original
  kind text not null check (kind in ('skip','moved')),
  new_start_at timestamptz,
  new_end_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, original_date)
);
alter table public.recurrence_exceptions enable row level security;
create policy "recurrence_exceptions_all_own" on public.recurrence_exceptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- casa / faxina ----------------------------------------------------
create table if not exists public.home_chores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  every_days int not null default 7 check (every_days >= 1),
  preferred_weekday smallint check (preferred_weekday between 0 and 6),
  estimated_minutes int,
  last_done_at timestamptz,
  next_due_date date,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists home_chores_user_idx on public.home_chores(user_id, next_due_date);
alter table public.home_chores enable row level security;
create policy "home_chores_all_own" on public.home_chores for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger home_chores_updated_at before update on public.home_chores for each row execute function public.set_updated_at();

create table if not exists public.home_chore_items (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references public.home_chores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  done boolean not null default false,   -- estado da rodada atual (zerado ao concluir)
  sort_order int not null default 0
);
create index if not exists home_chore_items_chore_idx on public.home_chore_items(chore_id);
alter table public.home_chore_items enable row level security;
create policy "home_chore_items_all_own" on public.home_chore_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.home_chore_logs (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references public.home_chores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  done_at timestamptz not null default now(),
  partial boolean not null default false,
  items_done int,
  items_total int,
  duration_minutes int,
  note text
);
create index if not exists home_chore_logs_user_idx on public.home_chore_logs(user_id, done_at);
alter table public.home_chore_logs enable row level security;
create policy "home_chore_logs_all_own" on public.home_chore_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- sono -------------------------------------------------------------
create table if not exists public.sleep_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bedtime time not null default '23:00',
  wake_time time not null default '07:00',
  target_hours numeric not null default 8,
  wind_down_minutes int not null default 30,
  evening_routine jsonb not null default '[]',   -- [{id,title}]
  morning_routine jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
alter table public.sleep_goals enable row level security;
create policy "sleep_goals_all_own" on public.sleep_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,                    -- dia em que acordou (no fuso do usuário)
  bed_at timestamptz not null,
  asleep_at timestamptz,
  wake_at timestamptz not null,
  quality smallint check (quality between 1 and 5),
  awakenings int,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, date),
  check (wake_at > bed_at)
);
create index if not exists sleep_logs_user_date_idx on public.sleep_logs(user_id, date);
alter table public.sleep_logs enable row level security;
create policy "sleep_logs_all_own" on public.sleep_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- foco -------------------------------------------------------------
create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity text not null,
  goal text,
  mode text not null default 'pomodoro' check (mode in ('pomodoro','custom','stopwatch','social_free')),
  planned_minutes int,
  actual_seconds int not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  completed boolean not null default false,
  interruptions int not null default 0,
  avoid_social boolean not null default false,
  habit_id uuid references public.habits(id) on delete set null,
  note text,
  client_id text,                        -- idempotência para sessões criadas offline
  unique (user_id, client_id)
);
create index if not exists focus_sessions_user_started_idx on public.focus_sessions(user_id, started_at);
alter table public.focus_sessions enable row level security;
create policy "focus_sessions_all_own" on public.focus_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- tempo de tela ----------------------------------------------------
create table if not exists public.screen_time_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  source text not null default 'manual' check (source in ('manual','measured','imported')),
  entries jsonb not null default '{}',   -- {"instagram": 45, "tiktok": 30, ...} em minutos
  total_minutes int not null default 0,
  conscious_use boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date, source)
);
create index if not exists screen_time_logs_user_date_idx on public.screen_time_logs(user_id, date);
alter table public.screen_time_logs enable row level security;
create policy "screen_time_logs_all_own" on public.screen_time_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger screen_time_logs_updated_at before update on public.screen_time_logs for each row execute function public.set_updated_at();

create table if not exists public.screen_time_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app text not null,                     -- 'instagram','tiktok','youtube','games','other','total'
  max_minutes int not null check (max_minutes >= 0),
  unique (user_id, app)
);
alter table public.screen_time_goals enable row level security;
create policy "screen_time_goals_all_own" on public.screen_time_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- metas ------------------------------------------------------------
create table if not exists public.personal_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  kind text not null default 'numeric' check (kind in ('numeric','completion')),
  target_value numeric,
  current_value numeric not null default 0,
  unit text,
  start_date date not null default current_date,
  deadline date,
  status text not null default 'active' check (status in ('active','completed','archived')),
  related_habit_ids uuid[] not null default '{}',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists personal_goals_user_idx on public.personal_goals(user_id, status);
alter table public.personal_goals enable row level security;
create policy "personal_goals_all_own" on public.personal_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger personal_goals_updated_at before update on public.personal_goals for each row execute function public.set_updated_at();

create table if not exists public.goal_progress (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.personal_goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta numeric not null default 0,
  value_after numeric not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists goal_progress_goal_idx on public.goal_progress(goal_id, created_at);
alter table public.goal_progress enable row level security;
create policy "goal_progress_all_own" on public.goal_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- diário -----------------------------------------------------------
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  content text,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  good_things text,
  improve text,
  learnings text,
  tomorrow_priorities text,
  search tsvector generated always as (
    to_tsvector('portuguese',
      coalesce(content,'') || ' ' || coalesce(good_things,'') || ' ' || coalesce(improve,'') || ' ' ||
      coalesce(learnings,'') || ' ' || coalesce(tomorrow_priorities,''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists journal_entries_search_idx on public.journal_entries using gin(search);
create index if not exists journal_entries_user_date_idx on public.journal_entries(user_id, date desc);
alter table public.journal_entries enable row level security;
create policy "journal_entries_all_own" on public.journal_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger journal_entries_updated_at before update on public.journal_entries for each row execute function public.set_updated_at();

-- ---------- notificações -----------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  habits boolean not null default true,
  events boolean not null default true,
  bedtime boolean not null default true,
  evening_routine boolean not null default true,
  morning_routine boolean not null default false,
  overdue_tasks boolean not null default true,
  overdue_tasks_time time not null default '09:00',
  quiet_start time,                       -- período silencioso (opcional)
  quiet_end time,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
create policy "notification_preferences_all_own" on public.notification_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions_all_own" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Registro de envios: garante que o agendador não envie o mesmo lembrete
-- duas vezes (chave determinística, ex.: "habit:<id>:2026-10-22").
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  title text not null,
  body text,
  sent_at timestamptz not null default now(),
  unique (user_id, key)
);
create index if not exists notification_log_user_sent_idx on public.notification_log(user_id, sent_at);
alter table public.notification_log enable row level security;
create policy "notification_log_select_own" on public.notification_log for select using (auth.uid() = user_id);
-- inserções são feitas apenas pelo servidor (service role, que ignora RLS)

-- ---------- trigger de novo usuário (depende das tabelas acima) --------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- exclusão total de dados (LGPD) -----------------------------------
-- Apaga todos os dados do usuário autenticado (as FKs em cascade fazem o resto).
create or replace function public.delete_my_data()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  delete from public.habits where user_id = uid;
  delete from public.tasks where user_id = uid;
  delete from public.events where user_id = uid;
  delete from public.recurrence_rules where user_id = uid;
  delete from public.home_chores where user_id = uid;
  delete from public.sleep_logs where user_id = uid;
  delete from public.focus_sessions where user_id = uid;
  delete from public.screen_time_logs where user_id = uid;
  delete from public.screen_time_goals where user_id = uid;
  delete from public.personal_goals where user_id = uid;
  delete from public.journal_entries where user_id = uid;
  delete from public.push_subscriptions where user_id = uid;
  delete from public.notification_log where user_id = uid;
  delete from public.categories where user_id = uid;
  update public.profiles set onboarding_completed = false, dashboard_habit_ids = '{}' where id = uid;
end $$;

-- Apaga a conta inteira (auth.users em cascade remove tudo).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = uid;
end $$;

grant execute on function public.delete_my_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
