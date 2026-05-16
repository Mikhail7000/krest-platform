-- ============================================================
-- v3.0 AI-first шаг 7: student_quiz_attempts + student_location_attempts
-- Зачем: лог попыток квизов/экзаменов и сдачи местописаний.
--   Связь с ai_call_log (стоимость + отладка).
--   Storage path для медиа местописаний (bucket student-recitations).
-- ============================================================

CREATE TABLE IF NOT EXISTS student_quiz_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_id        INTEGER REFERENCES blocks(id) ON DELETE CASCADE,
  exam_type       TEXT CHECK (exam_type IS NULL OR exam_type IN ('mid', 'final')),
  answers         JSONB NOT NULL,
  score_pct       INTEGER NOT NULL CHECK (score_pct BETWEEN 0 AND 100),
  passed          BOOLEAN NOT NULL,
  ai_call_id      UUID REFERENCES ai_call_log(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CHECK ((block_id IS NOT NULL AND exam_type IS NULL) OR (block_id IS NULL AND exam_type IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_sqa_user_block ON student_quiz_attempts(user_id, block_id);
CREATE INDEX IF NOT EXISTS idx_sqa_user_exam  ON student_quiz_attempts(user_id, exam_type);

ALTER TABLE student_quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sqa_select_visible ON student_quiz_attempts;
CREATE POLICY sqa_select_visible ON student_quiz_attempts FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_visible_to(auth.uid(), user_id)
    OR is_admin()
  );

DROP POLICY IF EXISTS sqa_all_admin ON student_quiz_attempts;
CREATE POLICY sqa_all_admin ON student_quiz_attempts FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE student_quiz_attempts IS
  'Лог попыток квизов и экзаменов. Поле answers — JSONB с ответами и AI-вердиктом.';


CREATE TABLE IF NOT EXISTS student_location_attempts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id           UUID NOT NULL REFERENCES block_locations_to_recite(id) ON DELETE CASCADE,
  telegram_message_id   BIGINT,
  source_type           TEXT NOT NULL CHECK (source_type IN ('video_note', 'voice')),
  storage_path          TEXT NOT NULL,
  file_size_bytes       INTEGER,
  duration_seconds      NUMERIC(6,2),
  transcript            TEXT,
  similarity_score      NUMERIC(4,3) CHECK (similarity_score IS NULL OR (similarity_score BETWEEN 0 AND 1)),
  passed                BOOLEAN NOT NULL,
  ai_comment            TEXT,
  ai_call_id            UUID REFERENCES ai_call_log(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sla_user     ON student_location_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_sla_location ON student_location_attempts(location_id);
CREATE INDEX IF NOT EXISTS idx_sla_passed   ON student_location_attempts(user_id, location_id) WHERE passed;

ALTER TABLE student_location_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sla_select_visible ON student_location_attempts;
CREATE POLICY sla_select_visible ON student_location_attempts FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_visible_to(auth.uid(), user_id)
    OR is_admin()
  );

DROP POLICY IF EXISTS sla_all_admin ON student_location_attempts;
CREATE POLICY sla_all_admin ON student_location_attempts FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE student_location_attempts IS
  'Лог попыток сдачи местописаний. Файл хранится в bucket student-recitations.';
