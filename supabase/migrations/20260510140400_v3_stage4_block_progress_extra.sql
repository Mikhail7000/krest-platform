-- ============================================================
-- v3.0 Stage 4 — student_block_progress: тайминги Этапа 4
-- Зачем: фиксируем когда блок стал доступен, когда сданы аудио-
--   местописания, видео-местописания, аудио-пересказ, видео-пересказ.
--   daily_cross_count — счётчик уникальных дней с фото креста
--   (поддерживается приложением: cron или после INSERT в
--   student_block_daily_cross — обновляется через server route).
--   block_passed_at нужен функции is_block_unlocked для расчёта
--   7-дневного gate.
-- Связано: docs/spec-first/04-ai-first-flow.md, Stage 4.
-- ============================================================

ALTER TABLE student_block_progress
  ADD COLUMN IF NOT EXISTS block_unlocked_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locations_audio_completed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locations_video_completed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recitation_audio_passed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recitation_videos_passed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS daily_cross_count             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS block_passed_at               TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sbp_block_passed_at
  ON student_block_progress(user_id, block_passed_at)
  WHERE block_passed_at IS NOT NULL;

COMMENT ON COLUMN student_block_progress.block_unlocked_at IS
  'Когда блок стал доступен ученику (для подсчёта 7-day gate от прошлого блока).';
COMMENT ON COLUMN student_block_progress.daily_cross_count IS
  'Счётчик уникальных дней с фото креста. Обновляется server-side при INSERT в student_block_daily_cross.';
COMMENT ON COLUMN student_block_progress.block_passed_at IS
  'Момент завершения блока (все этапы пройдены). Используется в is_block_unlocked.';
