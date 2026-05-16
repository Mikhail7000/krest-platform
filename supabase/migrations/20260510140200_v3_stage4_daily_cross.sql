-- ============================================================
-- v3.0 Stage 4 — student_block_daily_cross + bucket
-- Зачем: ежедневное фото нарисованного креста в течение блока.
--   Recurring 7 дней. AI содержимое НЕ проверяет — только факт
--   «загружено сегодня». Один уникальный submitted_date на user×block.
-- Связано: docs/spec-first/04-ai-first-flow.md, Stage 4 шаг 4.
-- ============================================================

CREATE TABLE IF NOT EXISTS student_block_daily_cross (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_id        INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  submitted_date  DATE NOT NULL,
  storage_path    TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, block_id, submitted_date)
);

CREATE INDEX IF NOT EXISTS idx_sbdc_user_block_date
  ON student_block_daily_cross(user_id, block_id, submitted_date DESC);

ALTER TABLE student_block_daily_cross ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sbdc_select_own ON student_block_daily_cross;
CREATE POLICY sbdc_select_own ON student_block_daily_cross FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS sbdc_all_admin ON student_block_daily_cross;
CREATE POLICY sbdc_all_admin ON student_block_daily_cross FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE student_block_daily_cross IS
  'Ежедневное фото нарисованного креста. Recurring 7 дней. AI не оценивает.';


-- ============================================================
-- Storage bucket: student-cross-photos
--   Private. Лимит файла 10 MB. Только фото-форматы.
--   RLS: ученик читает/пишет свою папку <user_id>/.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-cross-photos',
  'student-cross-photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS student_cross_photos_owner_all ON storage.objects;
CREATE POLICY student_cross_photos_owner_all ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'student-cross-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'student-cross-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS student_cross_photos_admin_all ON storage.objects;
CREATE POLICY student_cross_photos_admin_all ON storage.objects
  FOR ALL
  USING (bucket_id = 'student-cross-photos' AND is_admin())
  WITH CHECK (bucket_id = 'student-cross-photos' AND is_admin());
