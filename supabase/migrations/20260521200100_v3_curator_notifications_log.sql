-- ============================================================
-- v3.0: notifications_log — история уведомлений куратору
-- Зачем: логировать события для куратора (новый сабмишен, молчание, экзамен)
--   с возможностью mark as read.
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_id          INTEGER REFERENCES blocks(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'new_submission',      -- новый сабмишен
    'silence_1day',        -- молчание 1 день
    'silence_3days',       -- молчание 3+ дня
    'block_exam_ready',    -- студент готов к экзамену пункта 10
    'exam_passed'          -- экзамен пройден
  )),
  assignment_type   TEXT,  -- опционально, при new_submission
  read_at           TIMESTAMPTZ,   -- когда куратор прочитал
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(curator_id, student_id, block_id, notification_type, created_at::DATE)
);

CREATE INDEX IF NOT EXISTS idx_notif_curator ON notifications_log(curator_id);
CREATE INDEX IF NOT EXISTS idx_notif_student ON notifications_log(student_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread  ON notifications_log(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notif_type    ON notifications_log(notification_type);

ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

-- Куратор видит свои уведомления
DROP POLICY IF EXISTS notif_select_own ON notifications_log;
CREATE POLICY notif_select_own ON notifications_log FOR SELECT
  USING (curator_id = auth.uid() OR is_admin());

-- Система (admin/функции) может INSERT уведомления
DROP POLICY IF EXISTS notif_insert_system ON notifications_log;
CREATE POLICY notif_insert_system ON notifications_log FOR INSERT
  WITH CHECK (is_admin() OR curator_id = auth.uid());

-- Куратор может UPDATE (mark as read)
DROP POLICY IF EXISTS notif_update_own ON notifications_log;
CREATE POLICY notif_update_own ON notifications_log FOR UPDATE
  USING (curator_id = auth.uid() OR is_admin())
  WITH CHECK (curator_id = auth.uid() OR is_admin());

COMMENT ON TABLE notifications_log IS
  'История уведомлений куратору: новые сабмишены, молчания, результаты экзаменов.';
