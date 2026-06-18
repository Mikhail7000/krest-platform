-- Migration: access_requests — заявки на доступ от незнакомых Telegram-юзеров
-- Создаётся при первом обращении незнакомого пользователя (не в whitelist).
-- Решение принимается через Telegram inline-кнопки.

create table if not exists public.access_requests (
  id              uuid          primary key default gen_random_uuid(),
  telegram_chat_id bigint       not null unique,
  username        text,
  first_name      text,
  last_name       text,
  status          text          not null default 'pending'
                                check (status in ('pending', 'approved', 'rejected')),
  approved_role   text          check (approved_role in ('student', 'curator')),
  decided_by      bigint,
  decided_at      timestamptz,
  created_at      timestamptz   not null default now()
);

create index if not exists access_requests_status_idx on public.access_requests (status);

-- RLS включён, но публичных политик нет — доступ только через service_role
alter table public.access_requests enable row level security;
