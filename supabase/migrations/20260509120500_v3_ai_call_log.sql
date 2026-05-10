-- ============================================================
-- v3.0 AI-first шаг 6: ai_call_log
-- Зачем: аудит всех AI-вызовов (Anthropic, OpenAI Whisper) —
--   расходы, отладка ошибок, метрики качества.
--   Записи делает только server-side через service_role.
--   SELECT — только admin (телеметрия).
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_call_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai')),
  model           TEXT NOT NULL,
  purpose         TEXT NOT NULL CHECK (purpose IN (
                    'generate_quiz', 'check_quiz_answer',
                    'transcribe_audio', 'compare_location',
                    'summarize_transcript'
                  )),
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  duration_ms     INTEGER,
  success         BOOLEAN NOT NULL,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_acl_user    ON ai_call_log(user_id);
CREATE INDEX IF NOT EXISTS idx_acl_purpose ON ai_call_log(purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acl_failed  ON ai_call_log(created_at DESC) WHERE NOT success;

ALTER TABLE ai_call_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acl_select_admin ON ai_call_log;
CREATE POLICY acl_select_admin ON ai_call_log FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS acl_all_admin ON ai_call_log;
CREATE POLICY acl_all_admin ON ai_call_log FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE ai_call_log IS
  'Аудит AI-вызовов (Anthropic, OpenAI Whisper). Server-only INSERT.';
