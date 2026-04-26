-- ============================================================
-- Streak Mechanic — лог ежедневной активности студента
-- Зачем: ретеншн-механика по образу Bible.com (streak + Catch Me Up)
-- ============================================================

-- Streak counter и last_active_date в profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Лог ежедневной активности
CREATE TABLE IF NOT EXISTS streak_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  activity    TEXT NOT NULL CHECK (activity IN ('login', 'video_watched', 'forum_submitted', 'verse_memorized')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, log_date, activity)
);

CREATE INDEX IF NOT EXISTS idx_streak_logs_user_date ON streak_logs(user_id, log_date DESC);

ALTER TABLE streak_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS streak_logs_select_own ON streak_logs;
CREATE POLICY streak_logs_select_own ON streak_logs FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS streak_logs_insert_own ON streak_logs;
CREATE POLICY streak_logs_insert_own ON streak_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Верификация
SELECT 'streak_logs created' AS status, COUNT(*) AS rows FROM streak_logs;
