-- Привязка слота whitelist к конкретному Telegram-аккаунту.
-- При первом входе по username фиксируется chat_id, после чего слот
-- «занят» этим человеком навсегда: даже если username освободится и его
-- займёт другой аккаунт — он не получит доступ по этому слоту.

ALTER TABLE public.testing_whitelist
  ADD COLUMN IF NOT EXISTS claimed_chat_id BIGINT;

COMMENT ON COLUMN public.testing_whitelist.claimed_chat_id IS
  'Telegram chat_id, занявший слот при первом входе. NULL = слот ещё не активирован. После активации доступ привязан к этому chat_id.';
