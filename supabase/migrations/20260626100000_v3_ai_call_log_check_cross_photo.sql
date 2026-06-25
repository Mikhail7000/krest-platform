-- ai_call_log.purpose CHECK не включал 'check_cross_photo' (purpose добавлен в код
-- 5af9e1b, миграция не обновлена) → каждый INSERT лога AI-проверки фото падал на
-- CHECK, logAiCall глушил ошибку → 0 записей check_cross_photo при сотнях AI-вызовов.
-- Добавляем значение в CHECK.

ALTER TABLE public.ai_call_log DROP CONSTRAINT IF EXISTS ai_call_log_purpose_check;
ALTER TABLE public.ai_call_log ADD CONSTRAINT ai_call_log_purpose_check
  CHECK (purpose = ANY (ARRAY[
    'generate_quiz',
    'check_quiz_answer',
    'transcribe_audio',
    'compare_location',
    'summarize_transcript',
    'check_cross_photo'
  ]));
