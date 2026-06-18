-- ============================================================
-- v3.0 — ЕДИНАЯ дневная модель сдачи (решение Михаила 2026-06-18).
-- «Закрытый день» = ДАТА, за которую сданы ВСЕ дневные задания:
--   фото креста + молитва + местописания(аудио) + пересказ(кружки) + тренажёр.
-- Блок сдан = >=7 закрытых дней + квиз (1 раз) + эпоха пятницы (>=1).
-- Закрытые дни = ПЕРЕСЕЧЕНИЕ дат 5 заданий. Пропуски не сгорают.
-- ============================================================

-- Дневная отметка тренажёра (как daily_cross/daily_prayer)
CREATE TABLE IF NOT EXISTS public.student_block_daily_trainer (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  block_id     INTEGER NOT NULL,
  trained_date DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, block_id, trained_date)
);
ALTER TABLE public.student_block_daily_trainer ENABLE ROW LEVEL SECURITY;

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
  v_friday   INTEGER;
  v_days     INTEGER;
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

  -- Квиз (1 раз) и эпоха пятницы (>=1)
  SELECT quiz_passed_at INTO v_quiz
    FROM public.student_block_progress
   WHERE user_id = p_user_id AND block_id = v_prev_id;
  SELECT count(*) INTO v_friday
    FROM public.student_block_friday_practice
   WHERE user_id = p_user_id AND block_id = v_prev_id;

  -- Закрытые дни = пересечение дат всех 5 дневных заданий
  SELECT count(*) INTO v_days FROM (
    SELECT submitted_date AS d
      FROM public.student_block_daily_cross
     WHERE user_id = p_user_id AND block_id = v_prev_id
    INTERSECT
    SELECT prayed_date
      FROM public.student_block_daily_prayer
     WHERE user_id = p_user_id AND block_id = v_prev_id
    INTERSECT
    SELECT (created_at AT TIME ZONE 'UTC')::date
      FROM public.student_block_recitations
     WHERE user_id = p_user_id AND block_id = v_prev_id AND medium = 'audio' AND passed
    INTERSECT
    SELECT (created_at AT TIME ZONE 'UTC')::date
      FROM public.student_block_recitations
     WHERE user_id = p_user_id AND block_id = v_prev_id AND medium = 'video_note' AND passed
    INTERSECT
    SELECT trained_date
      FROM public.student_block_daily_trainer
     WHERE user_id = p_user_id AND block_id = v_prev_id
  ) x;

  RETURN (
        v_quiz IS NOT NULL
    AND COALESCE(v_friday, 0) >= 1
    AND COALESCE(v_days, 0)   >= 7
  );
END;
$$;

REVOKE ALL     ON FUNCTION is_block_unlocked(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_block_unlocked(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION is_block_unlocked(UUID, INTEGER) FROM authenticated;
GRANT  EXECUTE ON FUNCTION is_block_unlocked(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION is_block_unlocked(UUID, INTEGER) IS
  'Единая дневная модель: блок сдан = >=7 закрытых дней (пересечение дат фото+молитва+местописания audio+пересказ video+тренажёр) + квиз + эпоха пятницы>=1. order_num<=1/can_skip обходят.';
