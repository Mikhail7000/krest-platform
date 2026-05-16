-- ============================================================
-- v3.0 Шаг 1: Роли и иерархия
-- Зачем: 4-уровневая иерархия [super_admin > admin > curator > student],
--   защита владельца через is_protected, гео-привязка профиля,
--   аудит изменений ролей, функция видимости по прогрессии,
--   таблица course_progress (зависимость is_visible_to).
-- Связано с: SPEC.md v3.0 блок 0/2; .claude/rules/church-platform.md;
--   docs/spec-first/03-block1-maly-krest.md секция 12 (Этап Б шаг 1).
--
-- Все DDL через IF [NOT] EXISTS — миграция идемпотентна.
-- ============================================================


-- ============================================================
-- СЕКЦИЯ 1. is_admin() — расширяем до super_admin ДО смены ролей
--   Иначе после UPDATE Михаила в super_admin все старые RLS-политики
--   (use is_admin()) перестанут давать ему доступ.
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- СЕКЦИЯ 2. profiles.role enum: расширяем до 4 ролей
--   Сначала миграция возможных legacy-значений (root_admin → super_admin),
--   затем замена CHECK constraint.
-- ============================================================

UPDATE profiles SET role = 'super_admin' WHERE role = 'root_admin';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'curator', 'admin', 'super_admin'));


-- ============================================================
-- СЕКЦИЯ 3. Удаление устаревших колонок profiles (v2 онбординга)
--   gornitsa_type / region / city (TEXT) / blocks_unlocked заменены
--   на city_id / country_id / course_progress.
-- ============================================================

DROP INDEX IF EXISTS idx_profiles_nastavnik;
DROP INDEX IF EXISTS idx_profiles_city;

ALTER TABLE profiles DROP COLUMN IF EXISTS gornitsa_type;
ALTER TABLE profiles DROP COLUMN IF EXISTS region;
ALTER TABLE profiles DROP COLUMN IF EXISTS city;
ALTER TABLE profiles DROP COLUMN IF EXISTS blocks_unlocked;


-- ============================================================
-- СЕКЦИЯ 4. profiles: гео-привязка + curator_id (rename из nastavnik_id)
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_id INTEGER REFERENCES countries(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city_id    INTEGER REFERENCES cities(id);

-- Если nastavnik_id уже есть и curator_id ещё нет — переименовываем
-- (сохраняет данные). Иначе добавляем curator_id с нуля.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'nastavnik_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'curator_id'
  ) THEN
    ALTER TABLE profiles RENAME COLUMN nastavnik_id TO curator_id;
  END IF;
END $$;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  curator_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_curator ON profiles(curator_id);
CREATE INDEX IF NOT EXISTS idx_profiles_city    ON profiles(city_id);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role    ON profiles(role);


-- ============================================================
-- СЕКЦИЯ 5. is_protected — флаг защищённого владельца
--   Меняется только прямым SQL (намеренно неудобно).
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN profiles.is_protected IS
  'Защищён от разжалования/удаления через UI. Изменяется только прямым SQL.';

-- Михаил (sleezard@gmail.com) → super_admin + is_protected = TRUE
UPDATE profiles
SET role = 'super_admin', is_protected = TRUE
WHERE id IN (SELECT id FROM auth.users WHERE email = 'sleezard@gmail.com');


-- ============================================================
-- СЕКЦИЯ 6. course_progress — прогресс по курсам (зависимость is_visible_to)
-- ============================================================

CREATE TABLE IF NOT EXISTS course_progress (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id             INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'unlocked'
                        CHECK (status IN ('locked', 'unlocked', 'in_progress', 'completed')),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  final_exam_passed_at  TIMESTAMPTZ,
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_progress_user ON course_progress(user_id);

ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;

-- Политику с is_visible_to создаём в секции 9 (после самой функции).

-- Backfill: всем существующим профайлам открываем курс КРЕСТ как 'unlocked'.
INSERT INTO course_progress (user_id, course_id, status)
SELECT p.id, (SELECT id FROM courses WHERE slug = 'krest'), 'unlocked'
FROM profiles p
WHERE EXISTS (SELECT 1 FROM courses WHERE slug = 'krest')
ON CONFLICT (user_id, course_id) DO NOTHING;


-- ============================================================
-- СЕКЦИЯ 7. role_change_log — аудит изменений ролей
-- ============================================================

CREATE TABLE IF NOT EXISTS role_change_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_role        TEXT NOT NULL,
  new_role        TEXT NOT NULL,
  changed_by      UUID NOT NULL REFERENCES profiles(id),
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_role_changes_user
  ON role_change_log(changed_user_id, created_at DESC);

ALTER TABLE role_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_log_select_admins ON role_change_log;
CREATE POLICY role_log_select_admins ON role_change_log FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS role_log_insert_admins ON role_change_log;
CREATE POLICY role_log_insert_admins ON role_change_log FOR INSERT
  WITH CHECK (is_admin());


-- ============================================================
-- СЕКЦИЯ 8. is_visible_to(viewer, target) — функция видимости
--   Использует profiles.role, profiles.curator_id, profiles.city_id,
--   course_progress.status. Все зависимости созданы выше.
-- ============================================================

CREATE OR REPLACE FUNCTION is_visible_to(viewer_id UUID, target_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  viewer_role     TEXT;
  viewer_curator  UUID;
  viewer_city     INTEGER;
  target_curator  UUID;
BEGIN
  -- Сам себя
  IF viewer_id = target_id THEN
    RETURN TRUE;
  END IF;

  SELECT role, curator_id, city_id
    INTO viewer_role, viewer_curator, viewer_city
  FROM profiles WHERE id = viewer_id;

  -- Admin / super_admin видят всех
  IF viewer_role IN ('admin', 'super_admin') THEN
    RETURN TRUE;
  END IF;

  -- Куратор: свои ученики + другие кураторы своего города + их ученики
  IF viewer_role = 'curator' THEN
    IF EXISTS (
      SELECT 1 FROM profiles
      WHERE id = target_id AND curator_id = viewer_id
    ) THEN
      RETURN TRUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM profiles
      WHERE id = target_id AND role = 'curator' AND city_id = viewer_city
    ) THEN
      RETURN TRUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM profiles t
      JOIN profiles c ON c.id = t.curator_id
      WHERE t.id = target_id AND c.city_id = viewer_city
    ) THEN
      RETURN TRUE;
    END IF;

    RETURN FALSE;
  END IF;

  -- Студент: своя группа (один и тот же куратор)
  SELECT curator_id INTO target_curator FROM profiles WHERE id = target_id;
  IF viewer_curator IS NOT NULL AND viewer_curator = target_curator THEN
    RETURN TRUE;
  END IF;

  -- Прогрессия: оба прошли один и тот же курс
  IF EXISTS (
    SELECT 1
    FROM course_progress cp1
    JOIN course_progress cp2 ON cp1.course_id = cp2.course_id
    WHERE cp1.user_id = viewer_id AND cp1.status = 'completed'
      AND cp2.user_id = target_id AND cp2.status = 'completed'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;


-- ============================================================
-- СЕКЦИЯ 9. RLS-политики через is_visible_to
--   profiles: добавляем дополнительную SELECT-политику (PostgreSQL OR-объединяет).
--   course_progress: SELECT через is_visible_to.
-- ============================================================

DROP POLICY IF EXISTS profiles_select_visible ON profiles;
CREATE POLICY profiles_select_visible ON profiles FOR SELECT
  USING (is_visible_to(auth.uid(), id));

DROP POLICY IF EXISTS course_progress_select_visible ON course_progress;
CREATE POLICY course_progress_select_visible ON course_progress FOR SELECT
  USING (user_id = auth.uid() OR is_visible_to(auth.uid(), user_id));

DROP POLICY IF EXISTS course_progress_insert_self_or_admin ON course_progress;
CREATE POLICY course_progress_insert_self_or_admin ON course_progress FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS course_progress_update_admin ON course_progress;
CREATE POLICY course_progress_update_admin ON course_progress FOR UPDATE
  USING (is_admin());


-- ============================================================
-- VERIFICATION
-- ============================================================

-- 1. Профили: распределение ролей
SELECT 'profiles roles' AS info, role, COUNT(*) AS n
FROM profiles GROUP BY role ORDER BY role;

-- 2. Защищённый владелец (Михаил)
SELECT 'protected owner' AS info, p.id, u.email, p.role, p.is_protected
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.is_protected = TRUE;

-- 3. course_progress backfill
SELECT 'course_progress' AS info, c.slug, cp.status, COUNT(*) AS users
FROM course_progress cp
JOIN courses c ON c.id = cp.course_id
GROUP BY c.slug, cp.status;

-- 4. Колонки profiles после миграции
SELECT 'profiles columns' AS info, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 5. is_visible_to: Михаил (super_admin) видит сам себя и любого
SELECT 'is_visible_to(self)' AS info,
       is_visible_to(
         (SELECT id FROM auth.users WHERE email = 'sleezard@gmail.com'),
         (SELECT id FROM auth.users WHERE email = 'sleezard@gmail.com')
       ) AS result;
