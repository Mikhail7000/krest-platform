-- Реальный подсчёт сданных блоков по ДНЕВНОЙ модели (без block_passed_at,
-- который автоматически не ставится). Блок сдан = >=7 закрытых дней + квиз +
-- эпоха пятницы. Возвращает (user_id, blocks_passed) для всех учеников.
CREATE OR REPLACE FUNCTION passed_blocks_all()
RETURNS TABLE(user_id UUID, blocks_passed INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT cd.user_id, count(*)::int AS blocks_passed
  FROM (
    SELECT user_id, block_id, count(*) AS days
    FROM (
      SELECT user_id, block_id, d
      FROM (
        SELECT user_id, block_id, submitted_date AS d, 'cross' AS src
          FROM public.student_block_daily_cross
        UNION ALL SELECT user_id, block_id, prayed_date, 'prayer'
          FROM public.student_block_daily_prayer
        UNION ALL SELECT user_id, block_id, (created_at AT TIME ZONE 'UTC')::date, 'reca'
          FROM public.student_block_recitations WHERE medium = 'audio' AND passed
        UNION ALL SELECT user_id, block_id, (created_at AT TIME ZONE 'UTC')::date, 'recv'
          FROM public.student_block_recitations WHERE medium = 'video_note' AND passed
        UNION ALL SELECT user_id, block_id, trained_date, 'trainer'
          FROM public.student_block_daily_trainer
      ) tasks
      GROUP BY user_id, block_id, d
      HAVING count(DISTINCT src) = 5
    ) closed
    GROUP BY user_id, block_id
  ) cd
  WHERE cd.days >= 7
    AND EXISTS (
      SELECT 1 FROM public.student_block_progress p
       WHERE p.user_id = cd.user_id AND p.block_id = cd.block_id AND p.quiz_passed_at IS NOT NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.student_block_friday_practice f
       WHERE f.user_id = cd.user_id AND f.block_id = cd.block_id
    )
  GROUP BY cd.user_id;
$$;

REVOKE ALL     ON FUNCTION passed_blocks_all() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION passed_blocks_all() TO service_role;
