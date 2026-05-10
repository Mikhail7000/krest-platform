-- ============================================================
-- v3 Whitelist для production
-- Зачем: до публичного запуска платформа открыта только людям из
--   списка (Михаил + тестовые ученики, которым он лично дал доступ).
--   Остальные, даже если запустили @cross_bot, видят страницу
--   "Скоро откроемся".
-- Управление: SQL UPDATE profiles SET is_whitelisted=TRUE WHERE
--   telegram_chat_id=N (или через админку, когда будет).
-- super_admin / admin / curator — всегда доступ независимо от флага.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_whitelisted BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.is_whitelisted IS
  'TRUE = разрешён вход в MiniApp до публичного запуска. super_admin/admin/curator пускаются независимо.';

UPDATE public.profiles
   SET is_whitelisted = TRUE
 WHERE role IN ('super_admin', 'admin', 'curator')
   AND is_whitelisted = FALSE;
