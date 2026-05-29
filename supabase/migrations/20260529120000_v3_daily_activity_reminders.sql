-- Ежедневная активность ученика + дедуп напоминаний.
-- Одна строка на (user_id, день по Бали). opened=true → ученик заходил.
-- reminded_18/21 → напоминание уже отправлено в этот день (чтобы не дублировать).

create table if not exists public.student_daily_activity (
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_date date not null,
  opened boolean not null default false,
  opened_at timestamptz,
  reminded_18 boolean not null default false,
  reminded_21 boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

create index if not exists idx_sda_date on public.student_daily_activity (activity_date);

alter table public.student_daily_activity enable row level security;

-- Ученик может читать свою активность (для будущего экрана прогресса).
-- Запись идёт server-side через service_role (минует RLS).
drop policy if exists "sda_select_own" on public.student_daily_activity;
create policy "sda_select_own" on public.student_daily_activity
  for select using (auth.uid() = user_id);
