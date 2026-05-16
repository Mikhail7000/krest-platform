-- ============================================================
-- v3.0 Stage 4 — student_location_attempts: добавить medium
-- Зачем: ученик сначала шлёт АУДИО (voice), потом ВИДЕОКРУЖОК
--   (video_note). Разделяем формат через явное поле medium.
--   Дефолт 'audio' для совместимости с уже сданными попытками
--   (старая таблица source_type оставлена как есть для обратной
--   совместимости — её не трогаем).
-- Связано: docs/spec-first/04-ai-first-flow.md, Stage 4.
-- ============================================================

ALTER TABLE student_location_attempts
  ADD COLUMN IF NOT EXISTS medium TEXT NOT NULL DEFAULT 'audio'
    CHECK (medium IN ('audio', 'video_note'));

CREATE INDEX IF NOT EXISTS idx_sla_user_medium
  ON student_location_attempts(user_id, medium);

COMMENT ON COLUMN student_location_attempts.medium IS
  'Формат попытки: audio = voice (Этап 4 шаг 1), video_note = кружок (Этап 4 шаг 2).';
