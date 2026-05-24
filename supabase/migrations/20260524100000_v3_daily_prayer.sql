-- Ежедневная молитва по кресту (пункт ДЗ): галочка «помолился» на каждый из 7 дней.
-- Аналог student_block_daily_cross, но без файла — только факт отметки за дату.

CREATE TABLE IF NOT EXISTS public.student_block_daily_prayer (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  block_id    INTEGER NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  prayed_date DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, block_id, prayed_date)
);

COMMENT ON TABLE public.student_block_daily_prayer IS
  'Ежедневная отметка молитвы по кресту. Recurring 7 дней, на доверии (без проверки).';

ALTER TABLE public.student_block_daily_prayer ENABLE ROW LEVEL SECURITY;

-- Студент видит и ставит только свои отметки (API работает через service_role в обход).
DROP POLICY IF EXISTS daily_prayer_select_own ON public.student_block_daily_prayer;
CREATE POLICY daily_prayer_select_own ON public.student_block_daily_prayer
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_prayer_insert_own ON public.student_block_daily_prayer;
CREATE POLICY daily_prayer_insert_own ON public.student_block_daily_prayer
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_prayer_delete_own ON public.student_block_daily_prayer;
CREATE POLICY daily_prayer_delete_own ON public.student_block_daily_prayer
  FOR DELETE USING (auth.uid() = user_id);
