-- ============================================================
-- v3.0 — Аудит режима «view-as» (super_admin открывает панель куратора/админа).
-- Пишется из /api/panel/view-as при включении режима. RLS включён без политик →
-- доступ только service_role (панель ходит под service-role), остальным закрыто.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.view_as_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_role TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.view_as_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_view_as_log_actor ON public.view_as_log (actor_id, created_at DESC);

COMMENT ON TABLE public.view_as_log IS
  'Аудит view-as: какой super_admin (actor_id) открывал панель кого (target_id) и когда.';
