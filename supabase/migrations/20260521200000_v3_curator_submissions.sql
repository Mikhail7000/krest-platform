-- ============================================================
-- v3.0: submissions таблица для 12-пунктовой модели ДЗ
-- Зачем: хранить сабмишены студентов (текст, фото, видео, аудио)
--   с статусами одобрения куратором (pending → approved/rejected).
--   RLS: студент видит свои, куратор видит своих студентов.
-- ============================================================

CREATE TABLE IF NOT EXISTS submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_id          INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  assignment_type   TEXT NOT NULL CHECK (assignment_type IN (
    'reflection_forum',     -- пункт 4: форум-рефлексия (3 вопроса)
    'summary',              -- пункт 5: конспект
    'daily_cross',          -- пункт 6: крест ежедневный
    'locations',            -- пункт 7: местописания
    'friday_practice',      -- пункт 11: эпоха пятницы
    'daily_report'          -- пункт 12: эмоции + ежедневный отчёт
  )),
  daily_recurring   BOOLEAN DEFAULT FALSE,  -- TRUE для пунктов 6, 9, 12
  submission_date   DATE NOT NULL,           -- день, когда сдано
  content_text      TEXT,                    -- текст ответа
  content_json      JSONB,                   -- структурированные данные (для форума, эмоций)
  media_url         TEXT,                    -- Storage URI (фото, видео, аудио)
  media_type        TEXT CHECK (media_type IN ('image', 'video', 'audio', null)),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',        -- ожидает одобрения куратора
    'approved',       -- одобрено куратором
    'auto_approved',  -- одобрено автоматически (Kinescope ≥95%)
    'rejected'        -- отклонено куратором
  )),
  reviewer_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- куратор, одобривший
  reviewer_comment  TEXT,
  reviewed_at       TIMESTAMPTZ,             -- когда одобрено/отклонено
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, block_id, assignment_type, submission_date) -- одна сдача в день для recurring
);

CREATE INDEX IF NOT EXISTS idx_submissions_user      ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_block     ON submissions(block_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status    ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_date      ON submissions(submission_date);
CREATE INDEX IF NOT EXISTS idx_submissions_reviewer  ON submissions(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_submissions_pending   ON submissions(user_id, block_id) WHERE status = 'pending';

DROP TRIGGER IF EXISTS update_submissions_updated_at ON submissions;
CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Студент видит свои сабмишены
DROP POLICY IF EXISTS submissions_select_own ON submissions;
CREATE POLICY submissions_select_own ON submissions FOR SELECT
  USING (user_id = auth.uid() OR is_visible_to(auth.uid(), user_id) OR is_admin());

-- Куратор видит сабмишены своих студентов (через profiles.curator_id или is_visible_to)
DROP POLICY IF EXISTS submissions_select_curator ON submissions;
CREATE POLICY submissions_select_curator ON submissions FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role IN ('curator', 'admin', 'super_admin')
          AND EXISTS (
            SELECT 1 FROM profiles s
            WHERE s.id = submissions.user_id
              AND (s.curator_id = p.id OR is_visible_to(p.id, s.id))
          )
      )
      OR is_admin()
    )
  );

-- Студент может INSERT свои
DROP POLICY IF EXISTS submissions_insert_own ON submissions;
CREATE POLICY submissions_insert_own ON submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Куратор может UPDATE статус своих студентов
DROP POLICY IF EXISTS submissions_update_curator ON submissions;
CREATE POLICY submissions_update_curator ON submissions FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role IN ('curator', 'admin', 'super_admin')
          AND EXISTS (
            SELECT 1 FROM profiles s
            WHERE s.id = submissions.user_id
              AND (s.curator_id = p.id OR is_visible_to(p.id, s.id))
          )
      )
      OR is_admin()
    )
  )
  WITH CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved'));

DROP POLICY IF EXISTS submissions_all_admin ON submissions;
CREATE POLICY submissions_all_admin ON submissions FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE submissions IS
  'Сабмишены студентов по 12-пунктовой модели ДЗ. Одобрение куратором или авто-одобрение при ≥95% Kinescope.';
