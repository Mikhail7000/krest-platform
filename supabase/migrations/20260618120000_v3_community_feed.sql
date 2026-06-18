-- ============================================================
-- v3.0 — Глобальная лента «эмоции с мест действий»
-- Решение Михаила (2026-06-18): встроенная ГЛОБАЛЬНАЯ лента, все видят всех.
-- Посты: текст / аудио / видео-кружок / фото. На посте — имя автора + город.
-- Модерация: admin/curator/super_admin (и автор) могут удалять (soft-delete).
-- Доступ ведётся через service_role API + Telegram initData (как весь /m/*).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.community_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('text', 'audio', 'video_note', 'photo')),
  content_text TEXT,
  storage_path TEXT,
  is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_feed
  ON public.community_posts (created_at DESC)
  WHERE is_deleted = FALSE;

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

-- Доступ к данным — только через серверные API-роуты на service_role
-- (в MiniApp нет Supabase-сессии). Политика для authenticated — задел на будущее.
DROP POLICY IF EXISTS community_posts_select ON public.community_posts;
CREATE POLICY community_posts_select ON public.community_posts
  FOR SELECT TO authenticated USING (is_deleted = FALSE);

COMMENT ON TABLE public.community_posts IS
  'Глобальная лента эмоций с мест действий. Все видят все не-удалённые посты. Доступ через service_role API + initData.';

-- Приватный бакет для медиа ленты (аудио/видео-кружки/фото). Раздача — signed URL на сервере.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-media', 'community-media', FALSE, 52428800,
  ARRAY['audio/mp4','audio/x-m4a','audio/mpeg','audio/webm','video/mp4','video/webm','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;
