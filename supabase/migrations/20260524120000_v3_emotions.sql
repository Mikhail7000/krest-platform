-- Эмоции и свидетельства (пункт ДЗ, НЕобязательный): ученик делится опытом
-- после проповедования — текстом, аудио или видеокружком. Не влияет на экзамен.
-- Несколько записей на ученика×блок.

CREATE TABLE IF NOT EXISTS public.student_block_emotions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  block_id     INTEGER NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('text', 'audio', 'video_note')),
  content_text TEXT,
  storage_path TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_block_emotions IS
  'Эмоции и свидетельства: необязательный пункт — текст/аудио/кружок после проповедования. Не влияет на прохождение.';

ALTER TABLE public.student_block_emotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emotions_select_own ON public.student_block_emotions;
CREATE POLICY emotions_select_own ON public.student_block_emotions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS emotions_insert_own ON public.student_block_emotions;
CREATE POLICY emotions_insert_own ON public.student_block_emotions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
