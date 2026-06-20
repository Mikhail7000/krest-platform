-- Состояние «бот ждёт список ников» — когда админ отправил /add или
-- /addcurator БЕЗ ников, следующее сообщение со списком обрабатывается как
-- продолжение команды. Доступ только service_role (вебхук).
CREATE TABLE IF NOT EXISTS public.bot_pending_action (
  telegram_chat_id BIGINT PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('add', 'addcurator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_pending_action ENABLE ROW LEVEL SECURITY;
-- Политик нет: доступ только через service_role (он обходит RLS).
