-- ============================================================
-- v3.0 AI-first шаг 5: student_exam_progress
-- Зачем: статус mid-exam (после Блока 5) и final-exam (после Блока 10).
--   Pass-критерии MID=80, FINAL=85; те же лимиты 3 попытки + 24h.
-- ============================================================

CREATE TABLE IF NOT EXISTS student_exam_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam_type       TEXT NOT NULL CHECK (exam_type IN ('mid', 'final')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                    'pending', 'in_progress', 'passed', 'failed'
                  )),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_score_pct  INTEGER CHECK (last_score_pct IS NULL OR (last_score_pct BETWEEN 0 AND 100)),
  exam_locked_until TIMESTAMPTZ,
  passed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, exam_type)
);

CREATE INDEX IF NOT EXISTS idx_sep_user   ON student_exam_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_sep_passed ON student_exam_progress(user_id, exam_type) WHERE status = 'passed';

DROP TRIGGER IF EXISTS update_sep_updated_at ON student_exam_progress;
CREATE TRIGGER update_sep_updated_at
  BEFORE UPDATE ON student_exam_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE student_exam_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sep_select_visible ON student_exam_progress;
CREATE POLICY sep_select_visible ON student_exam_progress FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_visible_to(auth.uid(), user_id)
    OR is_admin()
  );

DROP POLICY IF EXISTS sep_all_admin ON student_exam_progress;
CREATE POLICY sep_all_admin ON student_exam_progress FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE student_exam_progress IS
  'Прогресс mid/final экзаменов курса.';
