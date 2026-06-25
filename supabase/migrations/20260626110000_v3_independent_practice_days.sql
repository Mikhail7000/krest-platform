-- ============================================================
-- v3.0 — НЕЗАВИСИМЫЙ подсчёт дней по 4 практикам (канон Михаила 2026-06-26).
--
-- Было: «закрытый день» = ДАТА, где сданы ВСЕ 4 практики (пересечение дат).
-- Проблема: если делать практики не строго в одну дату — частичные дни «теряются»
-- (фото есть, день не закрыт, дозакрыть прошлую дату нельзя). 7 дней почти нереально.
--
-- Стало: каждая практика считается НЕЗАВИСИМО (число уникальных дней с этой практикой).
-- «Закрыто дней» блока = МИНИМУМ из 4 практик. Блок сдан = КАЖДАЯ практика >= 7 дней.
-- Ничего не теряется: фото/молитва копятся в свой счётчик. Это модель «день висит,
-- пока не закроешь все 4» — реализованная без потери частичного прогресса.
--
-- Практики: cross (фото), prayer (молитва), recv (пересказ-аудио),
--           loc (местописания: ДАТА, где сданы ВСЕ обязательные видео-стихи блока).
-- Если у блока нет обязательных видео-стихов (req=0) — loc не ограничивает минимум.
-- ============================================================

-- Per-practice число уникальных дней по каждому блоку ученика.
CREATE OR REPLACE FUNCTION public.user_practice_day_counts(p_user_id uuid)
RETURNS TABLE(
  block_id integer, cross_days bigint, prayer_days bigint,
  recv_days bigint, loc_days bigint, loc_required boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  WITH blk AS (SELECT id FROM public.blocks WHERE order_num > 0),
  cross_c AS (
    SELECT block_id, count(DISTINCT submitted_date) d
    FROM public.student_block_daily_cross WHERE user_id = p_user_id GROUP BY block_id
  ),
  prayer_c AS (
    SELECT block_id, count(DISTINCT prayed_date) d
    FROM public.student_block_daily_prayer WHERE user_id = p_user_id GROUP BY block_id
  ),
  recv_c AS (
    SELECT block_id, count(DISTINCT COALESCE(effective_date,(created_at AT TIME ZONE 'UTC')::date)) d
    FROM public.student_block_recitations
    WHERE user_id = p_user_id AND medium = 'audio' AND passed GROUP BY block_id
  ),
  req AS (
    SELECT block_id, count(*) r FROM public.block_locations_to_recite
    WHERE is_required AND practice_mode IS NULL GROUP BY block_id
  ),
  loc_c AS (
    SELECT loc.block_id, count(*) d FROM (
      SELECT l.block_id, COALESCE(a.effective_date,(a.created_at AT TIME ZONE 'UTC')::date) AS dt,
             count(DISTINCT a.location_id) AS done
      FROM public.student_location_attempts a
      JOIN public.block_locations_to_recite l
        ON l.id = a.location_id AND l.is_required AND l.practice_mode IS NULL
      WHERE a.user_id = p_user_id AND a.medium = 'video_note' AND a.passed
      GROUP BY l.block_id, COALESCE(a.effective_date,(a.created_at AT TIME ZONE 'UTC')::date)
    ) loc
    JOIN req ON req.block_id = loc.block_id AND loc.done >= req.r
    GROUP BY loc.block_id
  )
  SELECT b.id,
         COALESCE(cc.d, 0), COALESCE(pc.d, 0), COALESCE(rc.d, 0), COALESCE(lc.d, 0),
         COALESCE((SELECT r FROM req WHERE req.block_id = b.id), 0) > 0
  FROM blk b
  LEFT JOIN cross_c  cc ON cc.block_id = b.id
  LEFT JOIN prayer_c pc ON pc.block_id = b.id
  LEFT JOIN recv_c   rc ON rc.block_id = b.id
  LEFT JOIN loc_c    lc ON lc.block_id = b.id;
$function$;

REVOKE ALL ON FUNCTION public.user_practice_day_counts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_practice_day_counts(uuid) TO service_role;

-- Закрыто дней = минимум из 4 практик (loc игнорируется, если у блока нет видео-стихов).
CREATE OR REPLACE FUNCTION public.user_closed_days(p_user_id uuid)
RETURNS TABLE(block_id integer, days bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT block_id,
         LEAST(cross_days, prayer_days, recv_days,
               CASE WHEN loc_required THEN loc_days ELSE 2147483647 END)
  FROM public.user_practice_day_counts(p_user_id);
$function$;

-- Блок открыт = предыдущий блок: каждая из 4 практик >= 7 дней (т.е. минимум >= 7).
CREATE OR REPLACE FUNCTION public.is_block_unlocked(p_user_id uuid, p_block_id integer)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_skip BOOLEAN; v_ord INTEGER; v_course INTEGER; v_prev_id INTEGER; v_days BIGINT;
BEGIN
  SELECT order_num, course_id INTO v_ord, v_course FROM public.blocks WHERE id = p_block_id;
  IF v_ord IS NULL THEN RETURN FALSE; END IF;
  IF v_ord <= 1 THEN RETURN TRUE; END IF;
  SELECT can_skip_block_lock INTO v_skip FROM public.profiles WHERE id = p_user_id;
  IF v_skip IS TRUE THEN RETURN TRUE; END IF;
  SELECT id INTO v_prev_id FROM public.blocks WHERE order_num = v_ord - 1 AND course_id = v_course;
  IF v_prev_id IS NULL THEN RETURN FALSE; END IF;

  SELECT days INTO v_days FROM public.user_closed_days(p_user_id) WHERE block_id = v_prev_id;
  RETURN COALESCE(v_days, 0) >= 7;
END; $function$;

REVOKE ALL ON FUNCTION public.is_block_unlocked(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_block_unlocked(uuid, integer) TO service_role;

-- Сдано блоков (все ученики) = блоки, где каждая практика >= 7 дней.
CREATE OR REPLACE FUNCTION public.passed_blocks_all()
RETURNS TABLE(user_id uuid, blocks_passed integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  WITH cross_c AS (
    SELECT user_id, block_id, count(DISTINCT submitted_date) d
    FROM public.student_block_daily_cross GROUP BY user_id, block_id
  ),
  prayer_c AS (
    SELECT user_id, block_id, count(DISTINCT prayed_date) d
    FROM public.student_block_daily_prayer GROUP BY user_id, block_id
  ),
  recv_c AS (
    SELECT user_id, block_id, count(DISTINCT COALESCE(effective_date,(created_at AT TIME ZONE 'UTC')::date)) d
    FROM public.student_block_recitations WHERE medium = 'audio' AND passed GROUP BY user_id, block_id
  ),
  req AS (
    SELECT block_id, count(*) r FROM public.block_locations_to_recite
    WHERE is_required AND practice_mode IS NULL GROUP BY block_id
  ),
  loc_c AS (
    SELECT loc.user_id, loc.block_id, count(*) d FROM (
      SELECT a.user_id, l.block_id, COALESCE(a.effective_date,(a.created_at AT TIME ZONE 'UTC')::date) AS dt,
             count(DISTINCT a.location_id) AS done
      FROM public.student_location_attempts a
      JOIN public.block_locations_to_recite l
        ON l.id = a.location_id AND l.is_required AND l.practice_mode IS NULL
      WHERE a.medium = 'video_note' AND a.passed
      GROUP BY a.user_id, l.block_id, COALESCE(a.effective_date,(a.created_at AT TIME ZONE 'UTC')::date)
    ) loc
    JOIN req ON req.block_id = loc.block_id AND loc.done >= req.r
    GROUP BY loc.user_id, loc.block_id
  )
  SELECT cc.user_id, count(*)::int
  FROM cross_c cc
  LEFT JOIN prayer_c pc ON pc.user_id = cc.user_id AND pc.block_id = cc.block_id
  LEFT JOIN recv_c   rc ON rc.user_id = cc.user_id AND rc.block_id = cc.block_id
  LEFT JOIN loc_c    lc ON lc.user_id = cc.user_id AND lc.block_id = cc.block_id
  LEFT JOIN req         ON req.block_id = cc.block_id
  WHERE LEAST(cc.d, COALESCE(pc.d, 0), COALESCE(rc.d, 0),
              CASE WHEN COALESCE(req.r, 0) > 0 THEN COALESCE(lc.d, 0) ELSE 2147483647 END) >= 7
  GROUP BY cc.user_id;
$function$;

REVOKE ALL ON FUNCTION public.passed_blocks_all() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passed_blocks_all() TO service_role;
