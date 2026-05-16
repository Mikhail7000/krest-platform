-- ============================================================
-- v3.0 Шаг 3: video_watch_progress — отслеживание просмотра видео
-- Зачем: для no-skip overlay на Kinescope. Запоминаем максимальный
--   просмотренный момент (max_watched_seconds), общую длительность
--   видео (total_seconds) и факт завершения (completed_at).
--   После завершения no-skip отключается — ученик может пересматривать
--   и перематывать свободно.
-- Связано с: SPEC.md v3.0, .claude/rules/church-platform.md (12-пунктовая
--   модель, пункты 2 и 3 — main_video и additional_video).
--
-- Все DDL через IF [NOT] EXISTS — миграция идемпотентна.
-- ============================================================

CREATE TABLE IF NOT EXISTS video_watch_progress (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_resource_id   UUID NOT NULL REFERENCES block_resources(id) ON DELETE CASCADE,
  max_watched_seconds INTEGER NOT NULL DEFAULT 0 CHECK (max_watched_seconds >= 0),
  total_seconds       INTEGER CHECK (total_seconds IS NULL OR total_seconds > 0),
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, block_resource_id)
);

CREATE INDEX IF NOT EXISTS idx_vwp_user
  ON video_watch_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_vwp_resource
  ON video_watch_progress(block_resource_id);
CREATE INDEX IF NOT EXISTS idx_vwp_completed
  ON video_watch_progress(user_id) WHERE completed_at IS NOT NULL;

DROP TRIGGER IF EXISTS update_vwp_updated_at ON video_watch_progress;
CREATE TRIGGER update_vwp_updated_at
  BEFORE UPDATE ON video_watch_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE video_watch_progress ENABLE ROW LEVEL SECURITY;

-- SELECT: свои + видимые через is_visible_to + admin
DROP POLICY IF EXISTS vwp_select_visible ON video_watch_progress;
CREATE POLICY vwp_select_visible ON video_watch_progress FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_visible_to(auth.uid(), user_id)
    OR is_admin()
  );

-- INSERT/UPDATE/DELETE — только admin (через UI),
-- ученик пишет свой прогресс через API route с service_role
-- (валидация Telegram initData на сервере).
DROP POLICY IF EXISTS vwp_all_admin ON video_watch_progress;
CREATE POLICY vwp_all_admin ON video_watch_progress FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

COMMENT ON TABLE video_watch_progress IS
  'Прогресс просмотра видео учениками. После completed_at != NULL no-skip overlay отключается.';
COMMENT ON COLUMN video_watch_progress.max_watched_seconds IS
  'Максимальная позиция в секундах, до которой ученик просмотрел видео (растёт монотонно).';
COMMENT ON COLUMN video_watch_progress.completed_at IS
  'Момент когда max_watched / total >= 0.95. NULL = ещё не завершил, no-skip активен.';


-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT 'video_watch_progress' AS info, c.relrowsecurity AS rls,
       (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'video_watch_progress') AS policies
FROM pg_class c WHERE c.relname = 'video_watch_progress';

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'video_watch_progress'
ORDER BY ordinal_position;
