-- ============================================================
-- v3.0 AI-first шаг 4: student_block_progress
-- Зачем: главный трекер прохождения блока учеником.
--   8 статусов: not_started → ... → block_completed.
--   quiz_attempts/quiz_locked_until — лимит 3 попытки + 24h пауза.
--   locations_attempts/locations_locked_until — то же для местописаний.
-- ============================================================

CREATE TABLE IF NOT EXISTS student_block_progress (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_id            INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
                        'not_started',
                        'video_watching',
                        'summary_reading',
                        'quiz_pending',
                        'quiz_passed',
                        'locations_pending',
                        'locations_passed',
                        'block_completed'
                      )),
  videos_completed_at      TIMESTAMPTZ,
  summary_acknowledged_at  TIMESTAMPTZ,
  quiz_passed_at           TIMESTAMPTZ,
  quiz_attempts            INTEGER NOT NULL DEFAULT 0,
  last_quiz_score_pct      INTEGER CHECK (last_quiz_score_pct IS NULL OR (last_quiz_score_pct BETWEEN 0 AND 100)),
  quiz_locked_until        TIMESTAMPTZ,
  locations_passed_at      TIMESTAMPTZ,
  locations_attempts       INTEGER NOT NULL DEFAULT 0,
  locations_locked_until   TIMESTAMPTZ,
  block_completed_at       TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at               TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, block_id)
);

CREATE INDEX IF NOT EXISTS idx_sbp_user      ON student_block_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_sbp_block     ON student_block_progress(block_id);
CREATE INDEX IF NOT EXISTS idx_sbp_status    ON student_block_progress(status);
CREATE INDEX IF NOT EXISTS idx_sbp_completed ON student_block_progress(user_id) WHERE status = 'block_completed';

DROP TRIGGER IF EXISTS update_sbp_updated_at ON student_block_progress;
CREATE TRIGGER update_sbp_updated_at
  BEFORE UPDATE ON student_block_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE student_block_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sbp_select_visible ON student_block_progress;
CREATE POLICY sbp_select_visible ON student_block_progress FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_visible_to(auth.uid(), user_id)
    OR is_admin()
  );

DROP POLICY IF EXISTS sbp_all_admin ON student_block_progress;
CREATE POLICY sbp_all_admin ON student_block_progress FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE student_block_progress IS
  'Главная таблица прогресса по AI-first потоку: статус блока ученика, тайминги, попытки.';
