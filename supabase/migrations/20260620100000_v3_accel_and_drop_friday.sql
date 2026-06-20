-- ============================================================
-- v3.0 — (1) Эпоха пятницы БОЛЬШЕ НЕ обязательна для сдачи блока
--        (объединяется с «Эмоции и свидетельства», необязательный раздел).
--        (2) test_daily_accel — режим тестировщика (Эля): дневные задания
--        штампуются виртуальными датами, можно закрыть много «дней» за день.
--        Для местописаний добавлена effective_date (виртуальная дата).
-- Гейт теперь: >=7 закрытых дней (фото+молитва+местописания audio+пересказ
-- video+тренажёр за одну дату) + квиз. Эпоха пятницы убрана из условий.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS test_daily_accel BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.student_block_recitations
  ADD COLUMN IF NOT EXISTS effective_date DATE;

-- ── is_block_unlocked: убрана эпоха пятницы, recitation по effective_date ──
CREATE OR REPLACE FUNCTION is_block_unlocked(p_user_id UUID, p_block_id INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_skip BOOLEAN; v_ord INTEGER; v_course INTEGER; v_prev_id INTEGER;
  v_quiz TIMESTAMPTZ; v_days INTEGER;
BEGIN
  SELECT order_num, course_id INTO v_ord, v_course FROM public.blocks WHERE id = p_block_id;
  IF v_ord IS NULL THEN RETURN FALSE; END IF;
  IF v_ord <= 1 THEN RETURN TRUE; END IF;
  SELECT can_skip_block_lock INTO v_skip FROM public.profiles WHERE id = p_user_id;
  IF v_skip IS TRUE THEN RETURN TRUE; END IF;
  SELECT id INTO v_prev_id FROM public.blocks WHERE order_num = v_ord - 1 AND course_id = v_course;
  IF v_prev_id IS NULL THEN RETURN FALSE; END IF;

  SELECT quiz_passed_at INTO v_quiz FROM public.student_block_progress
   WHERE user_id = p_user_id AND block_id = v_prev_id;

  SELECT count(*) INTO v_days FROM (
    SELECT submitted_date AS d FROM public.student_block_daily_cross
     WHERE user_id = p_user_id AND block_id = v_prev_id
    INTERSECT
    SELECT prayed_date FROM public.student_block_daily_prayer
     WHERE user_id = p_user_id AND block_id = v_prev_id
    INTERSECT
    SELECT COALESCE(effective_date, (created_at AT TIME ZONE 'UTC')::date)
     FROM public.student_block_recitations
     WHERE user_id = p_user_id AND block_id = v_prev_id AND medium = 'audio' AND passed
    INTERSECT
    SELECT COALESCE(effective_date, (created_at AT TIME ZONE 'UTC')::date)
     FROM public.student_block_recitations
     WHERE user_id = p_user_id AND block_id = v_prev_id AND medium = 'video_note' AND passed
    INTERSECT
    SELECT trained_date FROM public.student_block_daily_trainer
     WHERE user_id = p_user_id AND block_id = v_prev_id
  ) x;

  RETURN (v_quiz IS NOT NULL AND COALESCE(v_days, 0) >= 7);
END; $$;

-- ── user_closed_days: recitation по effective_date ──
CREATE OR REPLACE FUNCTION user_closed_days(p_user_id UUID)
RETURNS TABLE(block_id INTEGER, days BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT closed.block_id, count(*) AS days FROM (
    SELECT block_id, d FROM (
      SELECT block_id, submitted_date AS d, 'cross' AS src FROM public.student_block_daily_cross WHERE user_id = p_user_id
      UNION ALL SELECT block_id, prayed_date, 'prayer' FROM public.student_block_daily_prayer WHERE user_id = p_user_id
      UNION ALL SELECT block_id, COALESCE(effective_date,(created_at AT TIME ZONE 'UTC')::date), 'reca' FROM public.student_block_recitations WHERE user_id = p_user_id AND medium='audio' AND passed
      UNION ALL SELECT block_id, COALESCE(effective_date,(created_at AT TIME ZONE 'UTC')::date), 'recv' FROM public.student_block_recitations WHERE user_id = p_user_id AND medium='video_note' AND passed
      UNION ALL SELECT block_id, trained_date, 'trainer' FROM public.student_block_daily_trainer WHERE user_id = p_user_id
    ) tasks GROUP BY block_id, d HAVING count(DISTINCT src) = 5
  ) closed GROUP BY closed.block_id;
$$;

-- ── closed_dates_all: recitation по effective_date ──
CREATE OR REPLACE FUNCTION closed_dates_all()
RETURNS TABLE(user_id UUID, d DATE)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT DISTINCT closed.user_id, closed.d FROM (
    SELECT user_id, block_id, d FROM (
      SELECT user_id, block_id, submitted_date AS d, 'cross' AS src FROM public.student_block_daily_cross
      UNION ALL SELECT user_id, block_id, prayed_date, 'prayer' FROM public.student_block_daily_prayer
      UNION ALL SELECT user_id, block_id, COALESCE(effective_date,(created_at AT TIME ZONE 'UTC')::date), 'reca' FROM public.student_block_recitations WHERE medium='audio' AND passed
      UNION ALL SELECT user_id, block_id, COALESCE(effective_date,(created_at AT TIME ZONE 'UTC')::date), 'recv' FROM public.student_block_recitations WHERE medium='video_note' AND passed
      UNION ALL SELECT user_id, block_id, trained_date, 'trainer' FROM public.student_block_daily_trainer
    ) tasks GROUP BY user_id, block_id, d HAVING count(DISTINCT src) = 5
  ) closed;
$$;

-- ── passed_blocks_all: убрана эпоха пятницы, recitation по effective_date ──
CREATE OR REPLACE FUNCTION passed_blocks_all()
RETURNS TABLE(user_id UUID, blocks_passed INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT cd.user_id, count(*)::int AS blocks_passed FROM (
    SELECT user_id, block_id, count(*) AS days FROM (
      SELECT user_id, block_id, d FROM (
        SELECT user_id, block_id, submitted_date AS d, 'cross' AS src FROM public.student_block_daily_cross
        UNION ALL SELECT user_id, block_id, prayed_date, 'prayer' FROM public.student_block_daily_prayer
        UNION ALL SELECT user_id, block_id, COALESCE(effective_date,(created_at AT TIME ZONE 'UTC')::date), 'reca' FROM public.student_block_recitations WHERE medium='audio' AND passed
        UNION ALL SELECT user_id, block_id, COALESCE(effective_date,(created_at AT TIME ZONE 'UTC')::date), 'recv' FROM public.student_block_recitations WHERE medium='video_note' AND passed
        UNION ALL SELECT user_id, block_id, trained_date, 'trainer' FROM public.student_block_daily_trainer
      ) tasks GROUP BY user_id, block_id, d HAVING count(DISTINCT src) = 5
    ) closed GROUP BY user_id, block_id
  ) cd
  WHERE cd.days >= 7
    AND EXISTS (SELECT 1 FROM public.student_block_progress p
                 WHERE p.user_id=cd.user_id AND p.block_id=cd.block_id AND p.quiz_passed_at IS NOT NULL)
  GROUP BY cd.user_id;
$$;
