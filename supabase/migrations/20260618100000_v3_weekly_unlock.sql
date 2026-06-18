-- ============================================================
-- v3.0 — Недельная разблокировка блоков (per-student, по order_num)
-- Решение Михаила (2026-06-18): блоки открываются ПО ВРЕМЕНИ, индивидуально
-- от входа ученика. На старте открыты Блок 0 (Подготовка, order_num=0) и
-- Блок 1 (Малый крест, order_num=1). Блок order_num=N открывается через
-- (N-1) недель от course_started_at. Сдача предыдущего НЕ требуется.
-- can_skip_block_lock сохраняет обход (super_admin / тест).
-- ============================================================

-- Якорь старта курса (ставится при завершении онбординга)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS course_started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.course_started_at IS
  'Момент старта курса ученика (завершение онбординга). Точка отсчёта недельной разблокировки блоков.';

-- Бэкфилл для уже завершивших онбординг (иначе застрянут на Блоке 1)
UPDATE public.profiles
   SET course_started_at = NOW()
 WHERE onboarding_done IS TRUE
   AND course_started_at IS NULL;

-- Переписываем gate: считаем по order_num, недельная модель от course_started_at
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
  v_skip   BOOLEAN;
  v_ord    INTEGER;
  v_start  TIMESTAMPTZ;
BEGIN
  -- порядковый номер блока (НЕ id: Блок 0 имеет id 11, order_num 0)
  SELECT order_num INTO v_ord
    FROM public.blocks
   WHERE id = p_block_id;
  IF v_ord IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Подготовка (0) и Малый крест (1) открыты с момента старта
  IF v_ord <= 1 THEN
    RETURN TRUE;
  END IF;

  -- Глобальный обход (super_admin / тестовые ученики)
  SELECT can_skip_block_lock, course_started_at
    INTO v_skip, v_start
    FROM public.profiles
   WHERE id = p_user_id;

  IF v_skip IS TRUE THEN
    RETURN TRUE;
  END IF;

  -- Не начал курс (нет якоря) — открыты только 0/1
  IF v_start IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Недельная разблокировка: блок order_num=N доступен через (N-1) недель
  RETURN NOW() >= v_start + ((v_ord - 1) * INTERVAL '7 days');
END;
$$;

REVOKE ALL     ON FUNCTION is_block_unlocked(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_block_unlocked(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION is_block_unlocked(UUID, INTEGER) FROM authenticated;
GRANT  EXECUTE ON FUNCTION is_block_unlocked(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION is_block_unlocked(UUID, INTEGER) IS
  'Недельная разблокировка: TRUE если order_num<=1, can_skip_block_lock, или NOW() >= course_started_at + (order_num-1)*7 дней.';
