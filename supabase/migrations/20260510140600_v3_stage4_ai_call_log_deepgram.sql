-- ============================================================
-- v3.0 Stage 4 — расширение CHECK ai_call_log.provider
-- Зачем: добавляем 'deepgram' (Nova-2) в список провайдеров.
--   Используется в lib/ai/deepgram.ts при логировании транскрипций
--   голосовых от учеников (местописания + пересказ блока).
-- Связано: docs/spec-first/04-ai-first-flow.md, Stage 4.
-- ============================================================

ALTER TABLE ai_call_log
  DROP CONSTRAINT IF EXISTS ai_call_log_provider_check;

ALTER TABLE ai_call_log
  ADD CONSTRAINT ai_call_log_provider_check
  CHECK (provider IN ('anthropic', 'openai', 'deepgram'));

COMMENT ON COLUMN ai_call_log.provider IS
  'Провайдер LLM/ASR: anthropic, openai (Whisper), deepgram (Nova-2).';
