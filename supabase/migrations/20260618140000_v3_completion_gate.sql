-- ============================================================
-- v3.0 — Накопительная модель открытия блока (решение Михаила 2026-06-18).
-- Следующий блок открывается, когда у ПРЕДЫДУЩЕГО блока:
--   • сдан квиз (quiz_passed_at)
--   • сданы местописания: аудио + кружки (recitation_audio/videos_passed_at)
--   • накоплено >= 7 УНИКАЛЬНЫХ дней с фото креста (student_block_daily_cross)
-- Дни считаются по уникальным датам → пропуски НЕ сгорают (выпал/вернулся —
-- счётчик сохраняется). Заменяет календарную модель (course_started_at).
-- Подготовка(0)+Малый крест(1) открыты на старте. can_skip_block_lock обходит.
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
  v_ord        INTEGER;
  v_course     INTEGER;
  v_prev_id    INTEGER;
  v_quiz       TIMESTAMPTZ;
  v_rec_audio  TIMESTAMPTZ;
  v_rec_video  TIMESTAMPTZ;
  v_days       INTEGER;
BEGIN
  SELECT order_num, course_id INTO v_ord, v_course
    FROM public.blocks WHERE id = p_block_id;
  IF v_ord IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Подготовка (0) и Малый крест (1) открыты с момента старта
  IF v_ord <= 1 THEN
    RETURN TRUE;
  END IF;

  -- Глобальный обход (super_admin / тест)
  SELECT can_skip_block_lock INTO v_skip
    FROM public.profiles WHERE id = p_user_id;
  IF v_skip IS TRUE THEN
    RETURN TRUE;
  END IF;

  -- Предыдущий блок по order_num
  SELECT id INTO v_prev_id
    FROM public.blocks
   WHERE order_num = v_ord - 1 AND course_id = v_course;
  IF v_prev_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Флаги выполнения предыдущего блока
  SELECT quiz_passed_at, recitation_audio_passed_at, recitation_videos_passed_at
    INTO v_quiz, v_rec_audio, v_rec_video
    FROM public.student_block_progress
   WHERE user_id = p_user_id AND block_id = v_prev_id;

  -- Уникальные закрытые дни (фото креста), накопительно
  SELECT count(DISTINCT submitted_date) INTO v_days
    FROM public.student_block_daily_cross
   WHERE user_id = p_user_id AND block_id = v_prev_id;

  RETURN (
    v_quiz      IS NOT NULL
    AND v_rec_audio IS NOT NULL
    AND v_rec_video IS NOT NULL
    AND COALESCE(v_days, 0) >= 7
  );
END;
$$;

REVOKE ALL     ON FUNCTION is_block_unlocked(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_block_unlocked(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION is_block_unlocked(UUID, INTEGER) FROM authenticated;
GRANT  EXECUTE ON FUNCTION is_block_unlocked(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION is_block_unlocked(UUID, INTEGER) IS
  'Накопительная модель: order_num<=1 или can_skip → TRUE; иначе предыдущий блок должен иметь quiz_passed_at + recitation_audio/videos_passed_at + >=7 уникальных дней фото креста.';
