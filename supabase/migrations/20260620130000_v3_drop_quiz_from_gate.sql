-- Квиз больше НЕ обязателен для сдачи блока. Блок = >=7 закрытых дней.
-- (Эпоха пятницы убрана ранее.) Дневное задание = фото+молитва+
-- местописания(audio)+пересказ(video)+тренажёр за одну дату.

CREATE OR REPLACE FUNCTION is_block_unlocked(p_user_id UUID, p_block_id INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_skip BOOLEAN; v_ord INTEGER; v_course INTEGER; v_prev_id INTEGER; v_days INTEGER;
BEGIN
  SELECT order_num, course_id INTO v_ord, v_course FROM public.blocks WHERE id = p_block_id;
  IF v_ord IS NULL THEN RETURN FALSE; END IF;
  IF v_ord <= 1 THEN RETURN TRUE; END IF;
  SELECT can_skip_block_lock INTO v_skip FROM public.profiles WHERE id = p_user_id;
  IF v_skip IS TRUE THEN RETURN TRUE; END IF;
  SELECT id INTO v_prev_id FROM public.blocks WHERE order_num = v_ord - 1 AND course_id = v_course;
  IF v_prev_id IS NULL THEN RETURN FALSE; END IF;

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

  RETURN (COALESCE(v_days, 0) >= 7);
END; $$;

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
  GROUP BY cd.user_id;
$$;
