-- Хелпер: количество «закрытых дней» по каждому блоку ученика
-- (дата засчитана, если за неё сданы ВСЕ 5 дневных заданий). Для фронта.
CREATE OR REPLACE FUNCTION user_closed_days(p_user_id UUID)
RETURNS TABLE(block_id INTEGER, days BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT closed.block_id, count(*) AS days
  FROM (
    SELECT block_id, d
    FROM (
      SELECT block_id, submitted_date AS d, 'cross' AS src
        FROM public.student_block_daily_cross WHERE user_id = p_user_id
      UNION ALL
      SELECT block_id, prayed_date, 'prayer'
        FROM public.student_block_daily_prayer WHERE user_id = p_user_id
      UNION ALL
      SELECT block_id, (created_at AT TIME ZONE 'UTC')::date, 'reca'
        FROM public.student_block_recitations
       WHERE user_id = p_user_id AND medium = 'audio' AND passed
      UNION ALL
      SELECT block_id, (created_at AT TIME ZONE 'UTC')::date, 'recv'
        FROM public.student_block_recitations
       WHERE user_id = p_user_id AND medium = 'video_note' AND passed
      UNION ALL
      SELECT block_id, trained_date, 'trainer'
        FROM public.student_block_daily_trainer WHERE user_id = p_user_id
    ) tasks
    GROUP BY block_id, d
    HAVING count(DISTINCT src) = 5
  ) closed
  GROUP BY closed.block_id;
$$;

REVOKE ALL     ON FUNCTION user_closed_days(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION user_closed_days(UUID) TO service_role;
