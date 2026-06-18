-- ============================================================
-- v3.0 — ПОЛНЫЙ гейт сдачи блока (решение Михаила 2026-06-18).
-- Следующий блок открывается, когда у ПРЕДЫДУЩЕГО выполнено ВСЁ:
--   • квиз (quiz_passed_at)
--   • местописания аудио (recitation_audio_passed_at)
--   • пересказ кружки (recitation_videos_passed_at)
--   • тренажёр пройден (trainer_passed_at — НОВОЕ)
--   • >=7 уникальных дней фото креста
--   • >=7 уникальных дней молитвы по кресту
--   • эпоха пятницы >=1 раз
-- Всё накопительно, пропуски не сгорают. order_num<=1 / can_skip обходят.
-- ============================================================

ALTER TABLE public.student_block_progress
  ADD COLUMN IF NOT EXISTS trainer_passed_at TIMESTAMPTZ;

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
  v_skip     BOOLEAN;
  v_ord      INTEGER;
  v_course   INTEGER;
  v_prev_id  INTEGER;
  v_quiz     TIMESTAMPTZ;
  v_ra       TIMESTAMPTZ;
  v_rv       TIMESTAMPTZ;
  v_trainer  TIMESTAMPTZ;
  v_cross    INTEGER;
  v_prayer   INTEGER;
  v_friday   INTEGER;
BEGIN
  SELECT order_num, course_id INTO v_ord, v_course
    FROM public.blocks WHERE id = p_block_id;
  IF v_ord IS NULL THEN RETURN FALSE; END IF;
  IF v_ord <= 1 THEN RETURN TRUE; END IF;

  SELECT can_skip_block_lock INTO v_skip FROM public.profiles WHERE id = p_user_id;
  IF v_skip IS TRUE THEN RETURN TRUE; END IF;

  SELECT id INTO v_prev_id
    FROM public.blocks WHERE order_num = v_ord - 1 AND course_id = v_course;
  IF v_prev_id IS NULL THEN RETURN FALSE; END IF;

  SELECT quiz_passed_at, recitation_audio_passed_at, recitation_videos_passed_at, trainer_passed_at
    INTO v_quiz, v_ra, v_rv, v_trainer
    FROM public.student_block_progress
   WHERE user_id = p_user_id AND block_id = v_prev_id;

  SELECT count(DISTINCT submitted_date) INTO v_cross
    FROM public.student_block_daily_cross
   WHERE user_id = p_user_id AND block_id = v_prev_id;

  SELECT count(DISTINCT prayed_date) INTO v_prayer
    FROM public.student_block_daily_prayer
   WHERE user_id = p_user_id AND block_id = v_prev_id;

  SELECT count(*) INTO v_friday
    FROM public.student_block_friday_practice
   WHERE user_id = p_user_id AND block_id = v_prev_id;

  RETURN (
        v_quiz    IS NOT NULL
    AND v_ra      IS NOT NULL
    AND v_rv      IS NOT NULL
    AND v_trainer IS NOT NULL
    AND COALESCE(v_cross, 0)  >= 7
    AND COALESCE(v_prayer, 0) >= 7
    AND COALESCE(v_friday, 0) >= 1
  );
END;
$$;

REVOKE ALL     ON FUNCTION is_block_unlocked(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_block_unlocked(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION is_block_unlocked(UUID, INTEGER) FROM authenticated;
GRANT  EXECUTE ON FUNCTION is_block_unlocked(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION is_block_unlocked(UUID, INTEGER) IS
  'Полный гейт: предыдущий блок должен иметь quiz+recitation(audio/video)+trainer_passed + >=7 дней фото + >=7 дней молитвы + >=1 эпоха пятницы. order_num<=1/can_skip обходят.';
