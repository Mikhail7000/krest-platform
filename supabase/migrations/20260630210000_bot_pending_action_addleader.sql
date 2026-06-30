-- /addleader в боте: несколько ников разом + выбор города отдельным шагом.
-- Ники переносятся между шагами через payload (список '@ник @ник'); статусы
-- 'addleader' (ждём ники) и 'addleader_city' (ждём кнопку города) — новые.

ALTER TABLE public.bot_pending_action ADD COLUMN IF NOT EXISTS payload text;

ALTER TABLE public.bot_pending_action DROP CONSTRAINT IF EXISTS bot_pending_action_action_check;
ALTER TABLE public.bot_pending_action ADD CONSTRAINT bot_pending_action_action_check
  CHECK (action IN ('add', 'addcurator', 'addleader', 'addleader_city'));
