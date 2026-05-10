-- ============================================================
-- v3.0 AI-first шаг 1: course_intro_video + student_intro_progress
-- Зачем: вступительное видео курса как отдельная сущность,
--   не путать с additional_video Блока 1. Перед Блоком 1
--   обязательно ≥95% no-skip.
-- + Гибрид (в): UPDATE block_resources is_required=FALSE для
--   дубля «Вводного урока» в Блоке 1 (см. spec 04 §3.8).
-- ============================================================

CREATE TABLE IF NOT EXISTS course_intro_video (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     INTEGER NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
  title_ru      TEXT NOT NULL,
  description_ru TEXT,
  kinescope_id  TEXT NOT NULL,
  duration_sec  INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_course_intro_course
  ON course_intro_video(course_id);

DROP TRIGGER IF EXISTS update_course_intro_updated_at ON course_intro_video;
CREATE TRIGGER update_course_intro_updated_at
  BEFORE UPDATE ON course_intro_video
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE course_intro_video ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_intro_select_authenticated ON course_intro_video;
CREATE POLICY course_intro_select_authenticated ON course_intro_video FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS course_intro_all_admin ON course_intro_video;
CREATE POLICY course_intro_all_admin ON course_intro_video FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

COMMENT ON TABLE course_intro_video IS
  'Вступительное видео курса. Один на курс. ≥95% no-skip перед открытием Блока 1.';


-- student_intro_progress — прогресс просмотра вступления
CREATE TABLE IF NOT EXISTS student_intro_progress (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  intro_video_id      UUID NOT NULL REFERENCES course_intro_video(id) ON DELETE CASCADE,
  max_watched_seconds INTEGER NOT NULL DEFAULT 0 CHECK (max_watched_seconds >= 0),
  total_seconds       INTEGER CHECK (total_seconds IS NULL OR total_seconds > 0),
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, intro_video_id)
);

CREATE INDEX IF NOT EXISTS idx_sip_user
  ON student_intro_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_sip_video
  ON student_intro_progress(intro_video_id);
CREATE INDEX IF NOT EXISTS idx_sip_completed
  ON student_intro_progress(user_id) WHERE completed_at IS NOT NULL;

DROP TRIGGER IF EXISTS update_sip_updated_at ON student_intro_progress;
CREATE TRIGGER update_sip_updated_at
  BEFORE UPDATE ON student_intro_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE student_intro_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sip_select_visible ON student_intro_progress;
CREATE POLICY sip_select_visible ON student_intro_progress FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_visible_to(auth.uid(), user_id)
    OR is_admin()
  );

DROP POLICY IF EXISTS sip_all_admin ON student_intro_progress;
CREATE POLICY sip_all_admin ON student_intro_progress FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

COMMENT ON TABLE student_intro_progress IS
  'Прогресс просмотра course_intro_video учеником. Аналог video_watch_progress для intro.';


-- Seed: вступление для курса КРЕСТ (id=1)
INSERT INTO course_intro_video (course_id, title_ru, description_ru, kinescope_id)
VALUES (
  1,
  'Вводный урок',
  'Вступление перед курсом КРЕСТ. Алекс представляет суть курса.',
  'ntfUqbL89b9mrGzrgKrLbW'
)
ON CONFLICT (course_id) DO NOTHING;

-- Гибрид (в): убираем дубликат «Вводного урока» из обязательных в block_resources Блока 1
UPDATE block_resources
SET is_required = FALSE
WHERE block_id = 1 AND resource_type = 'additional_video';
