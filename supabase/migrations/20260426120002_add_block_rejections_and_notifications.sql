-- ============================================================
-- Block Rejections (история отклонений) + Notifications Log
-- Зачем: текущий notify-rejection удаляет данные навсегда — теряем история
-- ============================================================

-- История отклонений с комментариями
CREATE TABLE IF NOT EXISTS block_rejections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  block_id            INTEGER REFERENCES blocks(id) ON DELETE CASCADE NOT NULL,
  rejected_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rejection_comment   TEXT NOT NULL CHECK (length(rejection_comment) >= 10),
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_block_rejections_user_block ON block_rejections(user_id, block_id);
CREATE INDEX IF NOT EXISTS idx_block_rejections_created ON block_rejections(created_at DESC);

ALTER TABLE block_rejections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS block_rejections_select_own_or_admin ON block_rejections;
CREATE POLICY block_rejections_select_own_or_admin ON block_rejections FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS block_rejections_insert_admin ON block_rejections;
CREATE POLICY block_rejections_insert_admin ON block_rejections FOR INSERT
  WITH CHECK (is_admin());

-- Лог уведомлений (Telegram, email)
CREATE TABLE IF NOT EXISTS notifications_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (channel IN ('telegram', 'email')),
  type            TEXT NOT NULL,
  payload         JSONB,
  status          TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'queued')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications_log(status) WHERE status = 'queued';

ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_admin_only ON notifications_log;
CREATE POLICY notifications_admin_only ON notifications_log FOR ALL
  USING (is_admin());

-- Расширение student_progress для tracking отклонений
ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0;
ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Верификация
SELECT 'block_rejections created' AS status, COUNT(*) AS rows FROM block_rejections;
SELECT 'notifications_log created' AS status, COUNT(*) AS rows FROM notifications_log;
