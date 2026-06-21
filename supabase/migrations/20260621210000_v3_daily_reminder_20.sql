-- Вечернее напоминание 20:00 (Бали) — добавляем флаг, чтобы не дублировать.
-- Дополняет существующие reminded_18 / reminded_21 в student_daily_activity.

alter table public.student_daily_activity
  add column if not exists reminded_20 boolean not null default false;
