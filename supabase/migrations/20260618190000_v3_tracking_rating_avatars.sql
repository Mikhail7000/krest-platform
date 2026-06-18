-- ============================================================
-- v3.0 — Трекинг-рейтинг + аватарки (решение Михаила 2026-06-18).
-- Баллы = сумма позиций в серии по закрытым дням (серия длиннее → больше очков).
-- Аватарка в кружке + город в трекинге и ленте.
-- ============================================================

-- Аватарка профиля (путь в публичном бакете)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path TEXT;

-- Публичный бакет аватарок (показываются всем в трекинге/ленте)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', TRUE, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Все «закрытые даты» по каждому ученику (дата, за которую сданы все 5 дневных
-- заданий В РАМКАХ одного блока). Для подсчёта баллов и серий на сервере.
CREATE OR REPLACE FUNCTION closed_dates_all()
RETURNS TABLE(user_id UUID, d DATE)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT closed.user_id, closed.d
  FROM (
    SELECT user_id, block_id, d
    FROM (
      SELECT user_id, block_id, submitted_date AS d, 'cross' AS src
        FROM public.student_block_daily_cross
      UNION ALL
      SELECT user_id, block_id, prayed_date, 'prayer'
        FROM public.student_block_daily_prayer
      UNION ALL
      SELECT user_id, block_id, (created_at AT TIME ZONE 'UTC')::date, 'reca'
        FROM public.student_block_recitations WHERE medium = 'audio' AND passed
      UNION ALL
      SELECT user_id, block_id, (created_at AT TIME ZONE 'UTC')::date, 'recv'
        FROM public.student_block_recitations WHERE medium = 'video_note' AND passed
      UNION ALL
      SELECT user_id, block_id, trained_date, 'trainer'
        FROM public.student_block_daily_trainer
    ) tasks
    GROUP BY user_id, block_id, d
    HAVING count(DISTINCT src) = 5
  ) closed;
$$;

REVOKE ALL     ON FUNCTION closed_dates_all() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION closed_dates_all() TO service_role;
