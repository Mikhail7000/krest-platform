-- ============================================================
-- v3.0 AI-first шаг 2: block_quiz_questions
-- Зачем: вопросы теста по блоку. Sonnet генерит один раз,
--   потом редактируются вручную через админку (или скриптом).
--   Поддержка single_choice / multi_choice / free_text.
--   Флаги is_mid_exam / is_final_exam — для отбора в экзамены.
-- ============================================================

CREATE TABLE IF NOT EXISTS block_quiz_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id        INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  question_type   TEXT NOT NULL CHECK (question_type IN (
                    'single_choice', 'multi_choice', 'free_text'
                  )),
  question_text   TEXT NOT NULL,
  options         JSONB,
  correct_indices INTEGER[],
  expected_answer TEXT,
  rubric          TEXT,
  order_index     INTEGER NOT NULL DEFAULT 1,
  is_mid_exam     BOOLEAN NOT NULL DEFAULT FALSE,
  is_final_exam   BOOLEAN NOT NULL DEFAULT FALSE,
  generated_by_ai BOOLEAN NOT NULL DEFAULT TRUE,
  edited_manually BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bqq_block ON block_quiz_questions(block_id, order_index);
CREATE INDEX IF NOT EXISTS idx_bqq_mid   ON block_quiz_questions(block_id) WHERE is_mid_exam;
CREATE INDEX IF NOT EXISTS idx_bqq_final ON block_quiz_questions(block_id) WHERE is_final_exam;

DROP TRIGGER IF EXISTS update_bqq_updated_at ON block_quiz_questions;
CREATE TRIGGER update_bqq_updated_at
  BEFORE UPDATE ON block_quiz_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE block_quiz_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bqq_select_authenticated ON block_quiz_questions;
CREATE POLICY bqq_select_authenticated ON block_quiz_questions FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS bqq_all_admin ON block_quiz_questions;
CREATE POLICY bqq_all_admin ON block_quiz_questions FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE block_quiz_questions IS
  'Вопросы теста по блоку. Sonnet генерит один раз, потом редактируются вручную.';
