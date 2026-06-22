-- Вечернее напоминание по локальному поясу ученика (20:00 local).
-- Дедуп per (user_id, activity_date=локальная дата): один раз в локальный день.
alter table public.student_daily_activity
  add column if not exists reminded_evening boolean not null default false;
