-- Эпоха пятницы (практика, пункт ДЗ): выйти на места действия, передать «Малый
-- крест» другим, затем поделиться впечатлениями. Обязательный пункт.
-- Одна запись впечатлений на ученика×блок.

CREATE TABLE IF NOT EXISTS public.student_block_friday_practice (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  block_id    INTEGER NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  impressions TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, block_id)
);

COMMENT ON TABLE public.student_block_friday_practice IS
  'Эпоха пятницы: впечатления ученика после практики (передача Малого креста). Обязательный пункт блока.';

ALTER TABLE public.student_block_friday_practice ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS friday_practice_select_own ON public.student_block_friday_practice;
CREATE POLICY friday_practice_select_own ON public.student_block_friday_practice
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS friday_practice_write_own ON public.student_block_friday_practice;
CREATE POLICY friday_practice_write_own ON public.student_block_friday_practice
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS friday_practice_update_own ON public.student_block_friday_practice;
CREATE POLICY friday_practice_update_own ON public.student_block_friday_practice
  FOR UPDATE USING (auth.uid() = user_id);
