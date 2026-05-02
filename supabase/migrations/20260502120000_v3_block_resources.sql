-- ============================================================
-- v3.0 Шаг 2: block_resources — медиа-ресурсы блоков курса
-- Зачем: хранить ссылки на Kinescope-видео + пути в Storage для
--   аудио/PDF + текстовые ресурсы (транскрипты, гайды). Один блок
--   может иметь N ресурсов разных типов.
-- Связано с: SPEC.md v3.0; HANDOVER v9.0 «Этап Б шаг 2»;
--   memory/project_kinescope_mapping.md.
--
-- Все DDL через IF [NOT] EXISTS — миграция идемпотентна.
-- ============================================================

CREATE TABLE IF NOT EXISTS block_resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id        INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  resource_type   TEXT NOT NULL
                  CHECK (resource_type IN (
                    'main_video',
                    'additional_video',
                    'audio_prayer',
                    'pdf_prayer',
                    'guide_pdf',
                    'transcript'
                  )),
  title_ru        TEXT NOT NULL,
  description_ru  TEXT,
  kinescope_id    TEXT,
  storage_path    TEXT,
  transcript_md   TEXT,
  order_num       INTEGER NOT NULL DEFAULT 1,
  is_required     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_block_resources_block
  ON block_resources(block_id, order_num);
CREATE INDEX IF NOT EXISTS idx_block_resources_type
  ON block_resources(block_id, resource_type);

DROP TRIGGER IF EXISTS update_block_resources_updated_at ON block_resources;
CREATE TRIGGER update_block_resources_updated_at
  BEFORE UPDATE ON block_resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE block_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS block_resources_select_authenticated ON block_resources;
CREATE POLICY block_resources_select_authenticated ON block_resources FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS block_resources_all_admin ON block_resources;
CREATE POLICY block_resources_all_admin ON block_resources FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

COMMENT ON TABLE block_resources IS
  'Медиа-ресурсы блоков курса: видео (Kinescope), аудио/PDF (Storage), транскрипты/гайды (markdown в БД).';
COMMENT ON COLUMN block_resources.kinescope_id IS
  'ID видео в Kinescope. NULL для не-видео ресурсов.';
COMMENT ON COLUMN block_resources.storage_path IS
  'Путь в bucket block-resources, например 01-maly-krest/audio/molitva-korotkaya.m4a. NULL для видео и текстовых ресурсов.';
COMMENT ON COLUMN block_resources.transcript_md IS
  'Текст в markdown: транскрипт видео ИЛИ содержимое гайда. NULL для медиа-ресурсов.';


-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT 'block_resources' AS info, c.relname, c.relrowsecurity AS rls,
       (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'block_resources') AS policies
FROM pg_class c WHERE c.relname = 'block_resources';

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'block_resources'
ORDER BY ordinal_position;
