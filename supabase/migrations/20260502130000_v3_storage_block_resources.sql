-- ============================================================
-- v3.0 Шаг 2.2: Storage bucket block-resources (private)
-- Зачем: хранить аудио-молитвы (m4a), PDF молитв, картинки гайдов.
--   Bucket приватный — ученики получают доступ через signed URL,
--   которые генерирует Server Component с service_role.
-- Связано с: HANDOVER v9.0 «Этап Б шаг 2.2».
--
-- Идемпотентно: ON CONFLICT DO NOTHING + DROP POLICY IF EXISTS.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'block-resources',
  'block-resources',
  FALSE,
  52428800,
  ARRAY[
    'audio/mp4',
    'audio/x-m4a',
    'audio/mpeg',
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS на storage.objects уже включён глобально Supabase'ом.
-- Добавляем политики для нашего bucket: только admin/super_admin
-- получают прямой доступ. Ученики читают через signed URL (генерация
-- на сервере с service_role обходит RLS).

DROP POLICY IF EXISTS "block_resources_admin_select" ON storage.objects;
CREATE POLICY "block_resources_admin_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'block-resources' AND is_admin());

DROP POLICY IF EXISTS "block_resources_admin_insert" ON storage.objects;
CREATE POLICY "block_resources_admin_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'block-resources' AND is_admin());

DROP POLICY IF EXISTS "block_resources_admin_update" ON storage.objects;
CREATE POLICY "block_resources_admin_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'block-resources' AND is_admin())
WITH CHECK (bucket_id = 'block-resources' AND is_admin());

DROP POLICY IF EXISTS "block_resources_admin_delete" ON storage.objects;
CREATE POLICY "block_resources_admin_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'block-resources' AND is_admin());


-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'block-resources';

SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
  AND policyname LIKE 'block_resources_%'
ORDER BY policyname;
