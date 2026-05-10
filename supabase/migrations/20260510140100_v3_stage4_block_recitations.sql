-- ============================================================
-- v3.0 Stage 4 — student_block_recitations
-- Зачем: пересказ блока ученика своими словами (не дословно).
--   Шаг 3 Этапа 4: сначала аудио-пересказ, потом видеокружки.
--   AI оценивает связность/смысл (ai_score 0..100, ai_comment).
--   Файл хранится в bucket student-recitations.
-- Связано: docs/spec-first/04-ai-first-flow.md, Stage 4.
-- ============================================================

CREATE TABLE IF NOT EXISTS student_block_recitations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_id          INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  medium            TEXT NOT NULL CHECK (medium IN ('audio', 'video_note')),
  storage_path      TEXT NOT NULL,
  transcript        TEXT,
  duration_seconds  INTEGER,
  ai_score          NUMERIC(5,2) CHECK (ai_score IS NULL OR (ai_score BETWEEN 0 AND 100)),
  ai_comment        TEXT,
  passed            BOOLEAN NOT NULL,
  ai_call_id        UUID REFERENCES ai_call_log(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sbr_user_block_medium
  ON student_block_recitations(user_id, block_id, medium, created_at DESC);

ALTER TABLE student_block_recitations ENABLE ROW LEVEL SECURITY;

-- SELECT — только свои строки. INSERT/UPDATE/DELETE — только service_role
-- (не пишем явных политик для anon/authenticated → они блокируются по дефолту).
DROP POLICY IF EXISTS sbr_select_own ON student_block_recitations;
CREATE POLICY sbr_select_own ON student_block_recitations FOR SELECT
  USING (auth.uid() = user_id);

-- Admin / super_admin видят всё (для отладки и QA).
DROP POLICY IF EXISTS sbr_all_admin ON student_block_recitations;
CREATE POLICY sbr_all_admin ON student_block_recitations FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE student_block_recitations IS
  'Пересказ блока учеником (своими словами, не дословно). AI оценивает связность.';
