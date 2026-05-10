-- ============================================================
-- v3.0 Stage 4 — profiles.can_skip_block_lock
-- Зачем: для тестов и super_admin — обход 7-дневного gate между блоками.
--   Михаил и тестовые ученики могут проходить блоки подряд без задержки.
--   По умолчанию FALSE — обычные ученики ждут 7 дней (см. is_block_unlocked).
-- Связано: docs/spec-first/04-ai-first-flow.md, Stage 4.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS can_skip_block_lock BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.can_skip_block_lock IS
  'Если TRUE — обход 7-дневного gate между блоками. Для super_admin и тестов.';

-- Backfill: всем super_admin даём право обходить gate.
UPDATE profiles
   SET can_skip_block_lock = TRUE
 WHERE role = 'super_admin'
   AND can_skip_block_lock = FALSE;
