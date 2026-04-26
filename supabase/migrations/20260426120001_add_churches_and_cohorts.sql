-- ============================================================
-- Churches (B2B) + Cohorts (малые группы по Alpha)
-- Зачем: монетизация (пасторы-партнёры) + retention через коммьюнити
-- ============================================================

-- Церкви-партнёры
CREATE TABLE IF NOT EXISTS churches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  pastor_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  region          TEXT,
  size            TEXT CHECK (size IN ('small', 'medium', 'large', 'network')),
  invite_token    TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  plan            TEXT DEFAULT 'free' CHECK (plan IN ('free', 'church', 'network', 'enterprise')),
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_churches_pastor_id ON churches(pastor_id);
CREATE INDEX IF NOT EXISTS idx_churches_invite_token ON churches(invite_token);

-- Привязка студента к церкви
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_church_id ON profiles(church_id);

-- Малые группы (auto-cohort, до 12 человек на блок)
CREATE TABLE IF NOT EXISTS cohorts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id              INTEGER REFERENCES blocks(id) ON DELETE CASCADE NOT NULL,
  church_id             UUID REFERENCES churches(id) ON DELETE CASCADE,
  telegram_chat_id      BIGINT,
  telegram_invite_link  TEXT,
  status                TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
  member_count          INTEGER DEFAULT 0 CHECK (member_count BETWEEN 0 AND 12),
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  closed_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cohorts_block_status_open ON cohorts(block_id, status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_cohorts_church ON cohorts(church_id);

-- Участники когорт
CREATE TABLE IF NOT EXISTS cohort_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id   UUID REFERENCES cohorts(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(cohort_id, user_id)
);

-- RLS политики

ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS churches_select_own ON churches;
CREATE POLICY churches_select_own ON churches FOR SELECT
  USING (pastor_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS churches_insert_authenticated ON churches;
CREATE POLICY churches_insert_authenticated ON churches FOR INSERT
  WITH CHECK (pastor_id = auth.uid());

DROP POLICY IF EXISTS churches_update_pastor ON churches;
CREATE POLICY churches_update_pastor ON churches FOR UPDATE
  USING (pastor_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS cohorts_select_member_or_admin ON cohorts;
CREATE POLICY cohorts_select_member_or_admin ON cohorts FOR SELECT
  USING (
    is_admin()
    OR id IN (SELECT cohort_id FROM cohort_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS cohort_members_select_own_or_admin ON cohort_members;
CREATE POLICY cohort_members_select_own_or_admin ON cohort_members FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS cohort_members_insert_own ON cohort_members;
CREATE POLICY cohort_members_insert_own ON cohort_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Триггер для member_count
CREATE OR REPLACE FUNCTION update_cohort_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE cohorts SET member_count = member_count + 1 WHERE id = NEW.cohort_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE cohorts SET member_count = member_count - 1 WHERE id = OLD.cohort_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cohort_member_count ON cohort_members;
CREATE TRIGGER trg_cohort_member_count
  AFTER INSERT OR DELETE ON cohort_members
  FOR EACH ROW EXECUTE FUNCTION update_cohort_member_count();

-- Верификация
SELECT 'churches created' AS status, COUNT(*) AS rows FROM churches;
SELECT 'cohorts created' AS status, COUNT(*) AS rows FROM cohorts;
