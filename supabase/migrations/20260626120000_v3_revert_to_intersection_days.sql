-- ОТКАТ к модели «закрытый день = ДАТА со всеми 4 практиками сразу» (решение Михаила
-- 2026-06-26): за день нужно сдать фото + молитву + местописания + пересказ в ОДИН день.
-- Возвращаем closed_dates_all/user_closed_days/is_block_unlocked/passed_blocks_all к
-- версии-пересечению (как в 20260624020000). Функция user_practice_day_counts остаётся
-- (не используется).

CREATE OR REPLACE FUNCTION public.closed_dates_all()
RETURNS TABLE(user_id uuid, d date) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT DISTINCT closed.user_id, closed.d FROM (
    SELECT user_id, block_id, d FROM (
      SELECT user_id, block_id, submitted_date AS d, 'cross' AS src FROM public.student_block_daily_cross
      UNION ALL SELECT user_id, block_id, prayed_date, 'prayer' FROM public.student_block_daily_prayer
      UNION ALL SELECT user_id, block_id, COALESCE(effective_date,(created_at AT TIME ZONE 'UTC')::date), 'recv' FROM public.student_block_recitations WHERE medium='audio' AND passed
      UNION ALL
        SELECT loc.user_id, loc.block_id, loc.d, 'loc' FROM (
          SELECT a.user_id, l.block_id, COALESCE(a.effective_date,(a.created_at AT TIME ZONE 'UTC')::date) AS d, count(DISTINCT a.location_id) AS done
          FROM public.student_location_attempts a
          JOIN public.block_locations_to_recite l ON l.id = a.location_id AND l.is_required AND l.practice_mode IS NULL
          WHERE a.medium='video_note' AND a.passed
          GROUP BY a.user_id, l.block_id, COALESCE(a.effective_date,(a.created_at AT TIME ZONE 'UTC')::date)
        ) loc
        JOIN (SELECT block_id, count(*) req FROM public.block_locations_to_recite WHERE is_required AND practice_mode IS NULL GROUP BY block_id) rc
          ON rc.block_id = loc.block_id AND loc.done >= rc.req
    ) tasks GROUP BY user_id, block_id, d HAVING count(DISTINCT src) = 4
  ) closed;
$function$;

CREATE OR REPLACE FUNCTION public.user_closed_days(p_user_id uuid)
RETURNS TABLE(block_id integer, days bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT closed.block_id, count(*) AS days FROM (
    SELECT block_id, d FROM (
      SELECT block_id, submitted_date AS d, 'cross' AS src FROM public.student_block_daily_cross WHERE user_id = p_user_id
      UNION ALL SELECT block_id, prayed_date, 'prayer' FROM public.student_block_daily_prayer WHERE user_id = p_user_id
      UNION ALL SELECT block_id, COALESCE(effective_date,(created_at AT TIME ZONE 'UTC')::date), 'recv' FROM public.student_block_recitations WHERE user_id = p_user_id AND medium='audio' AND passed
      UNION ALL
        SELECT loc.block_id, loc.d, 'loc' FROM (
          SELECT l.block_id, COALESCE(a.effective_date,(a.created_at AT TIME ZONE 'UTC')::date) AS d, count(DISTINCT a.location_id) AS done
          FROM public.student_location_attempts a
          JOIN public.block_locations_to_recite l ON l.id = a.location_id AND l.is_required AND l.practice_mode IS NULL
          WHERE a.user_id = p_user_id AND a.medium='video_note' AND a.passed
          GROUP BY l.block_id, COALESCE(a.effective_date,(a.created_at AT TIME ZONE 'UTC')::date)
        ) loc
        JOIN (SELECT block_id, count(*) req FROM public.block_locations_to_recite WHERE is_required AND practice_mode IS NULL GROUP BY block_id) rc
          ON rc.block_id = loc.block_id AND loc.done >= rc.req
    ) tasks GROUP BY block_id, d HAVING count(DISTINCT src) = 4
  ) closed GROUP BY closed.block_id;
$function$;

CREATE OR REPLACE FUNCTION public.passed_blocks_all()
RETURNS TABLE(user_id uuid, blocks_passed integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT cd.user_id, count(*)::int AS blocks_passed FROM (
    SELECT user_id, block_id, count(*) AS days FROM (
      SELECT user_id, block_id, d FROM (
        SELECT user_id, block_id, submitted_date AS d, 'cross' AS src FROM public.student_block_daily_cross
        UNION ALL SELECT user_id, block_id, prayed_date, 'prayer' FROM public.student_block_daily_prayer
        UNION ALL SELECT user_id, block_id, COALESCE(effective_date,(created_at AT TIME ZONE 'UTC')::date), 'recv' FROM public.student_block_recitations WHERE medium='audio' AND passed
        UNION ALL
          SELECT loc.user_id, loc.block_id, loc.d, 'loc' FROM (
            SELECT a.user_id, l.block_id, COALESCE(a.effective_date,(a.created_at AT TIME ZONE 'UTC')::date) AS d, count(DISTINCT a.location_id) AS done
            FROM public.student_location_attempts a
            JOIN public.block_locations_to_recite l ON l.id = a.location_id AND l.is_required AND l.practice_mode IS NULL
            WHERE a.medium='video_note' AND a.passed
            GROUP BY a.user_id, l.block_id, COALESCE(a.effective_date,(a.created_at AT TIME ZONE 'UTC')::date)
          ) loc
          JOIN (SELECT block_id, count(*) req FROM public.block_locations_to_recite WHERE is_required AND practice_mode IS NULL GROUP BY block_id) rc
            ON rc.block_id = loc.block_id AND loc.done >= rc.req
      ) tasks GROUP BY user_id, block_id, d HAVING count(DISTINCT src) = 4
    ) closed GROUP BY user_id, block_id
  ) cd
  WHERE cd.days >= 7 GROUP BY cd.user_id;
$function$;

CREATE OR REPLACE FUNCTION public.is_block_unlocked(p_user_id uuid, p_block_id integer)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_skip BOOLEAN; v_ord INTEGER; v_course INTEGER; v_prev_id INTEGER; v_days INTEGER; v_req INTEGER;
BEGIN
  SELECT order_num, course_id INTO v_ord, v_course FROM public.blocks WHERE id = p_block_id;
  IF v_ord IS NULL THEN RETURN FALSE; END IF;
  IF v_ord <= 1 THEN RETURN TRUE; END IF;
  SELECT can_skip_block_lock INTO v_skip FROM public.profiles WHERE id = p_user_id;
  IF v_skip IS TRUE THEN RETURN TRUE; END IF;
  SELECT id INTO v_prev_id FROM public.blocks WHERE order_num = v_ord - 1 AND course_id = v_course;
  IF v_prev_id IS NULL THEN RETURN FALSE; END IF;

  SELECT count(*) INTO v_req FROM public.block_locations_to_recite WHERE block_id = v_prev_id AND is_required AND practice_mode IS NULL;

  SELECT count(*) INTO v_days FROM (
    SELECT submitted_date AS d FROM public.student_block_daily_cross WHERE user_id = p_user_id AND block_id = v_prev_id
    INTERSECT
    SELECT prayed_date FROM public.student_block_daily_prayer WHERE user_id = p_user_id AND block_id = v_prev_id
    INTERSECT
    SELECT COALESCE(effective_date,(created_at AT TIME ZONE 'UTC')::date) FROM public.student_block_recitations WHERE user_id = p_user_id AND block_id = v_prev_id AND medium = 'audio' AND passed
    INTERSECT
    SELECT loc.d FROM (
      SELECT COALESCE(a.effective_date,(a.created_at AT TIME ZONE 'UTC')::date) AS d, count(DISTINCT a.location_id) AS done
      FROM public.student_location_attempts a
      JOIN public.block_locations_to_recite l ON l.id = a.location_id AND l.is_required AND l.block_id = v_prev_id AND l.practice_mode IS NULL
      WHERE a.user_id = p_user_id AND a.medium = 'video_note' AND a.passed
      GROUP BY COALESCE(a.effective_date,(a.created_at AT TIME ZONE 'UTC')::date)
    ) loc
    WHERE (v_req = 0 OR loc.done >= v_req)
  ) x;

  RETURN (COALESCE(v_days, 0) >= 7);
END; $function$;
