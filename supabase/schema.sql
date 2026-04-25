-- ============================================================
-- CREST Learning Platform — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email         TEXT,
  full_name     TEXT,
  role          TEXT DEFAULT 'student' CHECK (role IN ('admin','student')),
  location_name TEXT,
  latitude      DECIMAL(9,6),
  longitude     DECIMAL(9,6),
  interests     TEXT,
  avatar_url    TEXT,
  lang          TEXT DEFAULT 'ru' CHECK (lang IN ('ru','en')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Course blocks (6 CREST blocks)
CREATE TABLE IF NOT EXISTS blocks (
  id             SERIAL PRIMARY KEY,
  order_num      INTEGER UNIQUE,
  letter         CHAR(1),
  title_ru       TEXT,
  title_en       TEXT,
  subtitle_ru    TEXT,
  subtitle_en    TEXT,
  description_ru TEXT,
  description_en TEXT,
  youtube_ru     TEXT,
  youtube_en     TEXT,
  content_ru     TEXT,
  content_en     TEXT,
  color          TEXT DEFAULT '#0071e3'
);

-- Lessons within each block
CREATE TABLE IF NOT EXISTS lessons (
  id          SERIAL PRIMARY KEY,
  block_id    INTEGER REFERENCES blocks ON DELETE CASCADE,
  order_num   INTEGER,
  title_ru    TEXT,
  title_en    TEXT,
  content_ru  TEXT,
  content_en  TEXT,
  youtube_url TEXT,
  verses      JSONB DEFAULT '[]'
);

-- Student progress per block
CREATE TABLE IF NOT EXISTS student_progress (
  id           SERIAL PRIMARY KEY,
  user_id      UUID REFERENCES profiles ON DELETE CASCADE,
  block_id     INTEGER REFERENCES blocks ON DELETE CASCADE,
  lesson_id    INTEGER REFERENCES lessons ON DELETE CASCADE,
  completed    BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  last_visited TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- Daily journal entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id                  SERIAL PRIMARY KEY,
  user_id             UUID REFERENCES profiles ON DELETE CASCADE,
  block_id            INTEGER REFERENCES blocks,
  lesson_id           INTEGER REFERENCES lessons,
  content             TEXT,
  submitted_to_leader BOOLEAN DEFAULT FALSE,
  submitted_at        TIMESTAMPTZ,
  leader_feedback     TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Bible verses memorized by students
CREATE TABLE IF NOT EXISTS bible_verses (
  id         SERIAL PRIMARY KEY,
  user_id    UUID REFERENCES profiles ON DELETE CASCADE,
  block_id   INTEGER REFERENCES blocks,
  lesson_id  INTEGER REFERENCES lessons,
  reference  TEXT,
  verse_text TEXT,
  memorized  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- File uploads (photos of handwritten notes, etc.)
CREATE TABLE IF NOT EXISTS uploads (
  id               SERIAL PRIMARY KEY,
  user_id          UUID REFERENCES profiles ON DELETE CASCADE,
  journal_entry_id INTEGER REFERENCES journal_entries ON DELETE CASCADE,
  file_url         TEXT,
  file_name        TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly Friday submissions
CREATE TABLE IF NOT EXISTS weekly_submissions (
  id               SERIAL PRIMARY KEY,
  user_id          UUID REFERENCES profiles ON DELETE CASCADE,
  week_number      INTEGER,
  block_id         INTEGER REFERENCES blocks,
  summary          TEXT,
  submitted_at     TIMESTAMPTZ DEFAULT NOW(),
  leader_reviewed  BOOLEAN DEFAULT FALSE,
  leader_feedback  TEXT
);

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons          ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bible_verses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_submissions ENABLE ROW LEVEL SECURITY;

-- Helper: is current user admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- profiles policies
DROP POLICY IF EXISTS "read own profile"   ON profiles;
DROP POLICY IF EXISTS "update own profile" ON profiles;
DROP POLICY IF EXISTS "admin update any"   ON profiles;
CREATE POLICY "read own profile"   ON profiles FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admin update any"   ON profiles FOR UPDATE USING (is_admin());

-- blocks & lessons: everyone reads, only admin writes
DROP POLICY IF EXISTS "read blocks"   ON blocks;
DROP POLICY IF EXISTS "admin blocks"  ON blocks;
DROP POLICY IF EXISTS "read lessons"  ON lessons;
DROP POLICY IF EXISTS "admin lessons" ON lessons;
CREATE POLICY "read blocks"   ON blocks  FOR SELECT USING (TRUE);
CREATE POLICY "admin blocks"  ON blocks  FOR ALL    USING (is_admin());
CREATE POLICY "read lessons"  ON lessons FOR SELECT USING (TRUE);
CREATE POLICY "admin lessons" ON lessons FOR ALL    USING (is_admin());

-- student_progress
DROP POLICY IF EXISTS "own progress" ON student_progress;
CREATE POLICY "own progress"   ON student_progress FOR ALL USING (auth.uid() = user_id OR is_admin());

-- journal_entries
DROP POLICY IF EXISTS "own journals" ON journal_entries;
CREATE POLICY "own journals"   ON journal_entries  FOR ALL USING (auth.uid() = user_id OR is_admin());

-- bible_verses
DROP POLICY IF EXISTS "own verses" ON bible_verses;
CREATE POLICY "own verses"     ON bible_verses     FOR ALL USING (auth.uid() = user_id OR is_admin());

-- uploads
DROP POLICY IF EXISTS "own uploads" ON uploads;
CREATE POLICY "own uploads"    ON uploads          FOR ALL USING (auth.uid() = user_id OR is_admin());

-- weekly_submissions
DROP POLICY IF EXISTS "own submissions" ON weekly_submissions;
CREATE POLICY "own submissions" ON weekly_submissions FOR ALL USING (auth.uid() = user_id OR is_admin());

-- ============================================================
-- Seed: 6 CREST Blocks
-- ============================================================
INSERT INTO blocks (order_num, letter, title_ru, title_en, subtitle_ru, subtitle_en, description_ru, description_en, color) VALUES
(1, 'C', 'Принцип Сотворения', 'Creation Principle',
 'Кем Бог создал человека?', 'Who did God create man to be?',
 'Бог — источник жизни. Человек создан духовным существом по образу Бога, для жизни в общении с Ним.',
 'God is the source of life. Man was created as a spiritual being in God''s image, to live in fellowship with Him.',
 '#0071e3'),
(2, 'R', 'Коренная Проблема', 'Root Problem',
 'Что пошло не так?', 'What went wrong?',
 'Человек разорвал отношения с Богом, приняв ложь. Грех — это неверие, духовная смерть.',
 'Man broke his relationship with God by accepting a lie. Sin is unbelief — spiritual death.',
 '#ff6b35'),
(3, 'E', '6 Состояний неверующего', '6 States of the Unbeliever',
 'Последствия жизни без Бога', 'Consequences of life without God',
 'Духовная смерть ведёт к шести состояниям: власть сатаны, идолы, тревога, болезни, смерть, поколения.',
 'Spiritual death leads to six states: power of satan, idols, anxiety, sickness, death, generational patterns.',
 '#8e44ad'),
(4, 'S', '3 Состояния мира', '3 States of the World',
 'Ложные пути к Богу', 'False paths to God',
 'Три ложных пути: религиозное, мистическое и языческое мышление — ни один не ведёт к Богу.',
 'Three false paths: religious, mystical and pagan thinking — none leads to God.',
 '#e67e22'),
(5, 'T', '3 Работы Христа', '3 Works of Christ',
 'Что Бог сделал для спасения', 'What God did for salvation',
 'Христос как Пророк, Священник и Царь решил все три проблемы человека.',
 'Christ as Prophet, Priest and King solved all three problems of man.',
 '#27ae60'),
(6, '+', '7 Благословений верующего', '7 Blessings of the Believer',
 'Что получает верующий', 'What the believer receives',
 'Новый статус, Святой Дух, молитвы, ангелы, власть над тьмой, небесное гражданство, Божья миссия.',
 'New status, Holy Spirit, answered prayers, angels, authority over darkness, heavenly citizenship, God''s mission.',
 '#2980b9')
ON CONFLICT DO NOTHING;
