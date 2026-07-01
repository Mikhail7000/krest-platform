-- Персональный замок владельца платформы.
-- profiles.owner_locked=TRUE → изменять этого пользователя (роль, куратор, город,
-- удаление, whitelist-слот) может ТОЛЬКО владелец платформы (профиль с is_protected=TRUE).
-- Отличие от is_protected: is_protected защищает владельца ОТ ВСЕХ (включая супер-админов),
-- owner_locked защищает аккаунт от всех, КРОМЕ владельца.
-- Проверка выполняется в API-слое (панель + Telegram-бот): lib/admin/locked.ts.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS owner_locked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.owner_locked IS
  'Аккаунт под личным управлением владельца: изменения разрешены только профилю с is_protected=TRUE';
