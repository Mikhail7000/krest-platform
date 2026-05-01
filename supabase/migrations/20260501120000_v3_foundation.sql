-- ============================================================
-- v3.0 Фундамент: мультикурсовая архитектура + 10 блоков КРЕСТ + гео
-- Зачем: переход со spec v2.0 (6 блоков, B2B churches/cohorts) на v3.0
--   (10 блоков, мультикурс КРЕСТ → 10 писем → 20 писем, 8 стран + 19+ городов)
-- Связано с: SPEC.md v3.0 блок 2; docs/spec-first/03-block1-maly-krest.md секция 12 (Этап Б шаг 0)
--
-- Все DDL через IF [NOT] EXISTS — миграция идемпотентна.
-- Контент продакшна вайпается осознанно: maintenance mode, прод закрыт.
--
-- ВНЕ ЗОНЫ этой миграции (будут в шагах 1-13):
--   - assignments / submissions / block_resources / course_progress / exams
--   - daily_activity / direct_messages / verse_progress / important_resources / role_change_log
--   - функции is_visible_to / is_block_completed
--   - profiles.role enum [super_admin/...] / curator_id / country_id / city_id / is_protected
-- ============================================================


-- ============================================================
-- СЕКЦИЯ 1. courses (мультикурс)
-- ============================================================

CREATE TABLE IF NOT EXISTS courses (
  id                      SERIAL PRIMARY KEY,
  slug                    TEXT UNIQUE NOT NULL,
  title_ru                TEXT NOT NULL,
  title_en                TEXT,
  description_ru          TEXT,
  order_num               INTEGER NOT NULL,
  unlock_after_course_id  INTEGER REFERENCES courses(id),
  status                  TEXT NOT NULL DEFAULT 'coming_soon'
                          CHECK (status IN ('active', 'coming_soon', 'archived')),
  created_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_courses_order ON courses(order_num);

-- RLS: SELECT для всех authenticated; ALL — только super_admin.
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS courses_select_authenticated ON courses;
CREATE POLICY courses_select_authenticated ON courses FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS courses_modify_super_admin ON courses;
CREATE POLICY courses_modify_super_admin ON courses FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Триггер updated_at (создаём функцию, если её нет)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_courses_updated ON courses;
CREATE TRIGGER trg_courses_updated
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed: КРЕСТ (active) + 10 писем (coming_soon, unlocked после КРЕСТ)
INSERT INTO courses (slug, title_ru, order_num, status)
VALUES ('krest', 'КРЕСТ', 1, 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (slug, title_ru, order_num, unlock_after_course_id, status)
VALUES (
  '10-pisem',
  '10 писем',
  2,
  (SELECT id FROM courses WHERE slug = 'krest'),
  'coming_soon'
)
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- СЕКЦИЯ 2. blocks: добавить course_id и slug, готовим к wipe + 10 новых
-- ============================================================

-- 2.1. Расширяем blocks
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id);
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS slug TEXT;

-- На случай если order_num имеет UNIQUE без учёта course_id — это легитимно пока курс один,
-- но нам нужно дать возможность переинсертить блоки. UNIQUE на order_num будет снят
-- в шаге 1 (когда станет UNIQUE(course_id, order_num)). На этом шаге не трогаем.

CREATE INDEX IF NOT EXISTS idx_blocks_course_order ON blocks(course_id, order_num);
CREATE UNIQUE INDEX IF NOT EXISTS uq_blocks_course_slug ON blocks(course_id, slug);


-- ============================================================
-- СЕКЦИЯ 3. Удаление устаревших таблиц v2.0
--   Делаем ДО wipe blocks, чтобы убрать FK-зависимости (cohorts, block_rejections).
-- ============================================================

DROP TABLE IF EXISTS cohort_members        CASCADE;
DROP TABLE IF EXISTS cohorts               CASCADE;
DROP TABLE IF EXISTS pastor_subscriptions  CASCADE;
DROP TABLE IF EXISTS churches              CASCADE;
DROP TABLE IF EXISTS streak_logs           CASCADE;
DROP TABLE IF EXISTS block_rejections      CASCADE;

-- profiles: убираем legacy колонки, которые теперь не нужны.
ALTER TABLE profiles DROP COLUMN IF EXISTS church_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS streak_count;
ALTER TABLE profiles DROP COLUMN IF EXISTS last_active_date;
-- Колонки gornitsa_type / city / region / nastavnik_id / blocks_unlocked
-- останутся — будут вычищены в шаге 1 «Роли и иерархия».


-- ============================================================
-- СЕКЦИЯ 4. Wipe старого контента блоков + seed 10 блоков курса КРЕСТ
--   Прод закрыт maintenance mode, данные продакшна можно вайпать.
--   Чистим зависимые таблицы CASCADE-эффектом, потом сами blocks.
-- ============================================================

-- Сначала чистим всё что ссылается на blocks/lessons (через CASCADE TRUNCATE).
-- TRUNCATE ... CASCADE дотягивается до всех зависимых таблиц.
TRUNCATE TABLE
  uploads,
  bible_verses,
  journal_entries,
  weekly_submissions,
  student_progress,
  lessons,
  blocks
RESTART IDENTITY CASCADE;

-- Seed 10 блоков курса КРЕСТ (course_id = id курса 'krest')
INSERT INTO blocks (course_id, order_num, title_ru, slug)
SELECT c.id, v.order_num, v.title_ru, v.slug
FROM courses c
CROSS JOIN (VALUES
  (1,  'Малый Крест',              'maly-krest'),
  (2,  'Принцип Сотворения',       'princip-sotvoreniya'),
  (3,  'Коренная Проблема',        'korennaya-problema'),
  (4,  'Состояние Мира',           'sostoyanie-mira'),
  (5,  'Состояние Неверующего',    'sostoyanie-neveruyushchego'),
  (6,  'Усилие Человека',          'usilie-cheloveka'),
  (7,  'Обетования и Исполнение',  'obetovaniya-i-ispolnenie'),
  (8,  'Иисус Христос',            'iisus-khristos'),
  (9,  'Благословения Верующего',  'blagosloveniya-veruyushchego'),
  (10, '5 Уверенностей',           '5-uverennostey')
) AS v(order_num, title_ru, slug)
WHERE c.slug = 'krest'
ON CONFLICT DO NOTHING;


-- ============================================================
-- СЕКЦИЯ 5. countries + cities (гео-структура)
-- ============================================================

CREATE TABLE IF NOT EXISTS countries (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,           -- ISO 3166-1 alpha-2
  name_ru     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS cities (
  id          SERIAL PRIMARY KEY,
  country_id  INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name_ru     TEXT NOT NULL,
  name_en     TEXT,
  timezone    TEXT NOT NULL DEFAULT 'UTC',
  status      TEXT DEFAULT 'coming_soon'
              CHECK (status IN ('active', 'coming_soon', 'inactive')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cities_country_status ON cities(country_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cities_country_name ON cities(country_id, name_ru);

-- RLS
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS countries_select_all ON countries;
CREATE POLICY countries_select_all ON countries FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS cities_select_all ON cities;
CREATE POLICY cities_select_all ON cities FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS countries_modify_super_admin ON countries;
CREATE POLICY countries_modify_super_admin ON countries FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS cities_modify_super_admin ON cities;
CREATE POLICY cities_modify_super_admin ON cities FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Seed: 9 стран
INSERT INTO countries (code, name_ru, name_en) VALUES
  ('RU', 'Россия',     'Russia'),
  ('ID', 'Индонезия',  'Indonesia'),
  ('TH', 'Тайланд',    'Thailand'),
  ('AE', 'ОАЭ',        'UAE'),
  ('GE', 'Грузия',     'Georgia'),
  ('IL', 'Израиль',    'Israel'),
  ('BY', 'Беларусь',   'Belarus'),
  ('US', 'США',        'USA'),
  ('VN', 'Вьетнам',    'Vietnam')
ON CONFLICT (code) DO NOTHING;

-- Seed: 9 зарубежных городов (Бали — единственный active)
INSERT INTO cities (country_id, name_ru, timezone, status)
SELECT c.id, v.name_ru, v.timezone, v.status
FROM countries c
JOIN (VALUES
  ('ID', 'Бали',             'Asia/Makassar',         'active'),
  ('TH', 'Пхукет',           'Asia/Bangkok',          'coming_soon'),
  ('AE', 'Дубай',            'Asia/Dubai',            'coming_soon'),
  ('GE', 'Тбилиси/Батуми',   'Asia/Tbilisi',          'coming_soon'),
  ('IL', 'Нагария',          'Asia/Jerusalem',        'coming_soon'),
  ('BY', 'Минск',            'Europe/Minsk',          'coming_soon'),
  ('US', 'Лас-Вегас',        'America/Los_Angeles',   'coming_soon'),
  ('US', 'Лос-Анжелес',      'America/Los_Angeles',   'coming_soon'),
  ('VN', 'Дананг',           'Asia/Bangkok',          'coming_soon')
) AS v(country_code, name_ru, timezone, status)
  ON c.code = v.country_code
ON CONFLICT (country_id, name_ru) DO NOTHING;

-- Seed: 19 городов РФ — все coming_soon на старте
INSERT INTO cities (country_id, name_ru, timezone, status)
SELECT c.id, v.name_ru, v.timezone, 'coming_soon'
FROM countries c
JOIN (VALUES
  ('Москва',           'Europe/Moscow'),
  ('Санкт-Петербург',  'Europe/Moscow'),
  ('Кемерово',         'Asia/Krasnoyarsk'),
  ('Екатеринбург',     'Asia/Yekaterinburg'),
  ('Томск',            'Asia/Tomsk'),
  ('Омск',             'Asia/Omsk'),
  ('Тюмень',           'Asia/Yekaterinburg'),
  ('Ярославль',        'Europe/Moscow'),
  ('Калининград',      'Europe/Kaliningrad'),
  ('Сочи',             'Europe/Moscow'),
  ('Нижний Новгород',  'Europe/Moscow'),
  ('Ростов',           'Europe/Moscow'),
  ('Иркутск',          'Asia/Irkutsk'),
  ('Казань',           'Europe/Moscow'),
  ('Калуга',           'Europe/Moscow'),
  ('Пермь',            'Asia/Yekaterinburg'),
  ('Уфа',              'Asia/Yekaterinburg'),
  ('Челябинск',        'Asia/Yekaterinburg'),
  ('Таганрог',         'Europe/Moscow')
) AS v(name_ru, timezone) ON TRUE
WHERE c.code = 'RU'
ON CONFLICT (country_id, name_ru) DO NOTHING;


-- ============================================================
-- VERIFICATION (читать в выводе apply_migration)
-- ============================================================

-- 1. Курсы (ожидается 2: krest active, 10-pisem coming_soon)
SELECT 'courses' AS table_name, slug, title_ru, status, order_num
FROM courses
ORDER BY order_num;

-- 2. Блоки курса КРЕСТ (ожидается 10)
SELECT 'blocks' AS table_name, b.order_num, b.title_ru, b.slug, c.slug AS course_slug
FROM blocks b
JOIN courses c ON c.id = b.course_id
ORDER BY c.order_num, b.order_num;

-- 3. Страны (ожидается 9)
SELECT 'countries' AS table_name, code, name_ru, status
FROM countries
ORDER BY code;

-- 4. Города (ожидается 28: 9 заруб. + 19 РФ; только Бали active)
SELECT 'cities' AS table_name, c.code AS country, ci.name_ru, ci.timezone, ci.status
FROM cities ci
JOIN countries c ON c.id = ci.country_id
ORDER BY c.code, ci.name_ru;

-- 5. Что удалили — должно отсутствовать
SELECT 'dropped tables check' AS table_name, tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('cohorts', 'cohort_members', 'churches', 'streak_logs',
                    'block_rejections', 'pastor_subscriptions');

-- 6. Что осталось — структура blocks
SELECT 'blocks columns' AS table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'blocks'
ORDER BY ordinal_position;
