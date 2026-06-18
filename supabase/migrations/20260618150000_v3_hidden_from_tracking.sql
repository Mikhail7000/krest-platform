-- Скрытие из общего трекинга (админы, скрытые тестировщики — Оля, единичка)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hidden_from_tracking BOOLEAN NOT NULL DEFAULT FALSE;

-- Флаг на whitelist → переносится в профиль при создании (для тестировщиков,
-- чей профиль пересоздаётся, напр. единичка)
ALTER TABLE public.testing_whitelist
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- Текущие keepers скрыты из трекинга
UPDATE public.profiles
   SET hidden_from_tracking = TRUE
 WHERE role IN ('admin', 'super_admin')
    OR lower(coalesce(contact_info, '')) = '@omeleshinka';

COMMENT ON COLUMN public.profiles.hidden_from_tracking IS
  'TRUE — не показывать в общем трекинге приложения (админы, скрытые тестировщики).';
