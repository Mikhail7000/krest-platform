-- ============================================================
-- v3.0 AI-first шаг 8: storage bucket student-recitations
-- Зачем: хранение video_note (mp4) и voice (ogg) ученика для
--   AI-проверки местописаний. Private. Лимит файла 20 MB.
-- RLS: ученик пишет/читает свою папку <user_id>/, admin — всё.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-recitations',
  'student-recitations',
  false,
  20971520,
  ARRAY['video/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/x-m4a', 'audio/mp4']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS student_recitations_owner_all ON storage.objects;
CREATE POLICY student_recitations_owner_all ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'student-recitations'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'student-recitations'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS student_recitations_admin_all ON storage.objects;
CREATE POLICY student_recitations_admin_all ON storage.objects
  FOR ALL
  USING (bucket_id = 'student-recitations' AND is_admin())
  WITH CHECK (bucket_id = 'student-recitations' AND is_admin());
