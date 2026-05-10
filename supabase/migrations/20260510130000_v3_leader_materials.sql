-- v3 AI-first: служебные материалы для будущей админки кураторов/лидеров.
-- Сейчас сюда кладутся 2 Kinescope-видео из «Кинескоп ссылки на видео.rtf»:
--   - «Инструкция для лидеров»
--   - «Вопрос-Ответ»
-- UI для этого раздела ещё не делается (отложено до рабочей версии ученического flow).
-- См. memory/project_priority_demo_first.md.

CREATE TABLE IF NOT EXISTS public.leader_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ru text NOT NULL,
  description_ru text,
  kinescope_id text NOT NULL,
  duration_sec integer,
  order_num integer NOT NULL DEFAULT 0,
  access_role text NOT NULL DEFAULT 'curator', -- curator | admin | super_admin
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.leader_materials IS
  'Служебные видео для лидеров/кураторов курса (инструкции, разборы). Не для учеников. UI появится позже.';
COMMENT ON COLUMN public.leader_materials.access_role IS
  'Минимальная роль для доступа: curator | admin | super_admin.';

CREATE INDEX IF NOT EXISTS leader_materials_order_idx
  ON public.leader_materials (order_num);

ALTER TABLE public.leader_materials ENABLE ROW LEVEL SECURITY;

-- SELECT — только для curator/admin/super_admin. Анонимам и студентам — недоступно.
DROP POLICY IF EXISTS leader_materials_select ON public.leader_materials;
CREATE POLICY leader_materials_select
  ON public.leader_materials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('curator', 'admin', 'super_admin')
    )
  );

-- INSERT/UPDATE/DELETE — только service_role (миграции и админ-скрипты).
-- Никаких политик для authenticated/anon — RLS отказывает по умолчанию.
