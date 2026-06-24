-- student_days (отчёт активности): местописания тоже исключают audio-притчи
-- (practice_mode IS NULL), чтобы «день закрыт» совпадал с гейтом closed_dates_all.

CREATE OR REPLACE FUNCTION public.student_days(p_user_ids uuid[])
RETURNS TABLE(
  user_id uuid, d date, opened boolean, cross_done boolean, prayer_done boolean,
  recit_done boolean, loc_done boolean, quiz_done boolean, closed boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH req AS (
    SELECT block_id, count(*) AS req FROM public.block_locations_to_recite
    WHERE is_required AND practice_mode IS NULL GROUP BY block_id
  ),
  loc_complete AS (
    SELECT lb.user_id, lb.block_id, lb.d FROM (
      SELECT a.user_id, l.block_id,
             COALESCE(a.effective_date,(a.created_at AT TIME ZONE 'UTC')::date) AS d,
             count(DISTINCT a.location_id) AS done
      FROM public.student_location_attempts a
      JOIN public.block_locations_to_recite l ON l.id = a.location_id AND l.is_required AND l.practice_mode IS NULL
      WHERE a.user_id = ANY(p_user_ids) AND a.medium = 'video_note' AND a.passed
      GROUP BY a.user_id, l.block_id, COALESCE(a.effective_date,(a.created_at AT TIME ZONE 'UTC')::date)
    ) lb JOIN req ON req.block_id = lb.block_id AND lb.done >= req.req
  ),
  loc_complete_ud AS (SELECT DISTINCT user_id, d FROM loc_complete),
  closed_ud AS (
    SELECT DISTINCT user_id, d FROM (
      SELECT user_id, block_id, d FROM (
        SELECT user_id, block_id, submitted_date AS d, 'cross' AS src FROM public.student_block_daily_cross WHERE user_id = ANY(p_user_ids)
        UNION ALL SELECT user_id, block_id, prayed_date, 'prayer' FROM public.student_block_daily_prayer WHERE user_id = ANY(p_user_ids)
        UNION ALL SELECT user_id, block_id, COALESCE(effective_date,(created_at AT TIME ZONE 'UTC')::date), 'recv' FROM public.student_block_recitations WHERE user_id = ANY(p_user_ids) AND medium='audio' AND passed
        UNION ALL SELECT user_id, block_id, d, 'loc' FROM loc_complete
      ) tasks GROUP BY user_id, block_id, d HAVING count(DISTINCT src) = 4
    ) c
  ),
  dates AS (
    SELECT user_id, activity_date AS d FROM public.student_daily_activity WHERE user_id = ANY(p_user_ids) AND opened AND activity_date IS NOT NULL
    UNION SELECT user_id, submitted_date FROM public.student_block_daily_cross WHERE user_id = ANY(p_user_ids)
    UNION SELECT user_id, prayed_date FROM public.student_block_daily_prayer WHERE user_id = ANY(p_user_ids)
    UNION SELECT user_id, COALESCE(effective_date,(created_at AT TIME ZONE 'UTC')::date) FROM public.student_block_recitations WHERE user_id = ANY(p_user_ids) AND medium='audio' AND passed
    UNION SELECT user_id, COALESCE(effective_date,(created_at AT TIME ZONE 'UTC')::date) FROM public.student_location_attempts WHERE user_id = ANY(p_user_ids) AND medium='video_note' AND passed
    UNION SELECT user_id, (created_at AT TIME ZONE 'UTC')::date FROM public.student_quiz_attempts WHERE user_id = ANY(p_user_ids) AND passed
  ),
  uniq AS (SELECT DISTINCT user_id, d FROM dates WHERE d IS NOT NULL)
  SELECT
    u.user_id, u.d,
    EXISTS(SELECT 1 FROM public.student_daily_activity a WHERE a.user_id=u.user_id AND a.activity_date=u.d AND a.opened),
    EXISTS(SELECT 1 FROM public.student_block_daily_cross c WHERE c.user_id=u.user_id AND c.submitted_date=u.d),
    EXISTS(SELECT 1 FROM public.student_block_daily_prayer p WHERE p.user_id=u.user_id AND p.prayed_date=u.d),
    EXISTS(SELECT 1 FROM public.student_block_recitations r WHERE r.user_id=u.user_id AND r.medium='audio' AND r.passed AND COALESCE(r.effective_date,(r.created_at AT TIME ZONE 'UTC')::date)=u.d),
    EXISTS(SELECT 1 FROM loc_complete_ud lc WHERE lc.user_id=u.user_id AND lc.d=u.d),
    EXISTS(SELECT 1 FROM public.student_quiz_attempts q WHERE q.user_id=u.user_id AND q.passed AND (q.created_at AT TIME ZONE 'UTC')::date=u.d),
    EXISTS(SELECT 1 FROM closed_ud cu WHERE cu.user_id=u.user_id AND cu.d=u.d)
  FROM uniq u
  ORDER BY u.user_id, u.d DESC;
$$;
