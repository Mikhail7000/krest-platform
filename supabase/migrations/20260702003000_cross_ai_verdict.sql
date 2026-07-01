-- AI-вердикт сверки фото креста с эталоном — ПЕРСИСТИМ (2026-07-02).
-- Раньше checkCrossPhoto возвращал matched/feedback только в ответ клиенту и
-- вердикт терялся; куратор в панели перепроверял фото глазами.
-- NULL = ИИ не проверял (сбой/несовместимый формат/тест-режим) — fail-open.

ALTER TABLE public.student_block_daily_cross
  ADD COLUMN IF NOT EXISTS ai_matched BOOLEAN,
  ADD COLUMN IF NOT EXISTS ai_feedback TEXT;
