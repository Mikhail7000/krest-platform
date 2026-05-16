-- ============================================================
-- v3.0 AI-first шаг 3: block_locations_to_recite
-- Зачем: эталоны местописаний и притч для AI-проверки.
--   check_mode='verbatim' — слово-в-слово, AI сравнивает текст;
--   check_mode='meaning' — пересказ сути, AI проверяет по rubric.
--   is_required=FALSE — info-only (например Быт 1:28 в Блоке 2).
-- topic_label — опциональный педагогический ярлык
--   («уверенность в спасении» для Блока 10 и т.п.).
-- ============================================================

CREATE TABLE IF NOT EXISTS block_locations_to_recite (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id      INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  reference     TEXT NOT NULL,
  exact_text    TEXT NOT NULL,
  check_mode    TEXT NOT NULL DEFAULT 'verbatim' CHECK (check_mode IN ('verbatim', 'meaning')),
  is_required   BOOLEAN NOT NULL DEFAULT TRUE,
  order_index   INTEGER NOT NULL DEFAULT 1,
  similarity_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.85
                CHECK (similarity_threshold BETWEEN 0 AND 1),
  rubric        TEXT,
  topic_label   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(block_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_blr_block    ON block_locations_to_recite(block_id, order_index);
CREATE INDEX IF NOT EXISTS idx_blr_required ON block_locations_to_recite(block_id) WHERE is_required;

DROP TRIGGER IF EXISTS update_blr_updated_at ON block_locations_to_recite;
CREATE TRIGGER update_blr_updated_at
  BEFORE UPDATE ON block_locations_to_recite
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE block_locations_to_recite ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blr_select_authenticated ON block_locations_to_recite;
CREATE POLICY blr_select_authenticated ON block_locations_to_recite FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS blr_all_admin ON block_locations_to_recite;
CREATE POLICY blr_all_admin ON block_locations_to_recite FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE block_locations_to_recite IS
  'Эталоны местописаний и притч для AI-проверки. verbatim/meaning + is_required.';
