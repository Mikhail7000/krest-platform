-- ============================================================
-- v3.0 Stage 4 — функция is_block_unlocked(user_id, block_id)
-- Зачем: единая точка проверки «доступен ли ученику блок N».
--   Логика:
--     1) Блок 1 — всегда TRUE.
--     2) profiles.can_skip_block_lock = TRUE → TRUE (тесты, super_admin).
--     3) Иначе ищем student_block_progress (user, block - 1):
--        - block_passed_at IS NULL → FALSE (предыдущий не пройден);
--        - block_passed_at + 7 days <= now() → TRUE;
--        - иначе FALSE (ждём окончания gate).
-- Связано: docs/spec-first/04-ai-first-flow.md, Stage 4.
-- ============================================================

CREATE OR REPLACE FUNCTION is_block_unlocked(
  p_user_id UUID,
  p_block_id INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_skip       BOOLEAN;
  v_passed_at  TIMESTAMPTZ;
BEGIN
  -- Блок 1 — всегда доступен
  IF p_block_id <= 1 THEN
    RETURN TRUE;
  END IF;

  -- Глобальный обход (super_admin / тестовые ученики)
  SELECT can_skip_block_lock INTO v_skip
    FROM public.profiles
   WHERE id = p_user_id;
  IF v_skip IS TRUE THEN
    RETURN TRUE;
  END IF;

  -- Состояние предыдущего блока
  SELECT block_passed_at INTO v_passed_at
    FROM public.student_block_progress
   WHERE user_id = p_user_id
     AND block_id = p_block_id - 1;

  IF v_passed_at IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_passed_at + INTERVAL '7 days' <= NOW() THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION is_block_unlocked(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_block_unlocked(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION is_block_unlocked(UUID, INTEGER) FROM authenticated;
GRANT  EXECUTE ON FUNCTION is_block_unlocked(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION is_block_unlocked(UUID, INTEGER) IS
  'Stage 4: TRUE если блок доступен ученику (Блок 1 всегда; can_skip_block_lock; 7-day gate от block_passed_at прошлого блока).';
