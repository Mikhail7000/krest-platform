-- Add Telegram chat_id to profiles so students can receive approval notifications

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;

-- Verification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
