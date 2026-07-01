-- Видимость city_leader через ЛЮДЕЙ, а не через город ученика (2026-07-02).
-- Панель уже переведена (lib/admin/scope.ts, коммит 7e267a8): лидер видит учеников
-- ТОЛЬКО через кураторов своего города. Эта миграция выравнивает RLS-функцию
-- is_visible_to (MiniApp-видимость): раньше лидер видел ЛЮБОЙ профиль с city_id
-- своего города — ученик без куратора «всплывал» у лидера (кейс Капсулы Тест).
-- Кураторы/лидеры своего города остаются видимыми (это люди лидера).

CREATE OR REPLACE FUNCTION public.is_visible_to(viewer_id uuid, target_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
DECLARE
  viewer_role TEXT; viewer_curator UUID; viewer_city INTEGER; target_curator UUID;
BEGIN
  IF viewer_id = target_id THEN RETURN TRUE; END IF;
  SELECT role, curator_id, city_id INTO viewer_role, viewer_curator, viewer_city FROM profiles WHERE id = viewer_id;
  IF viewer_role IN ('admin', 'super_admin') THEN RETURN TRUE; END IF;

  IF viewer_role = 'city_leader' THEN
    IF viewer_city IS NULL THEN RETURN FALSE; END IF;
    -- Штатные своего города (кураторы/лидеры) — видимы: это люди лидера.
    IF EXISTS (
      SELECT 1 FROM profiles
      WHERE id = target_id AND city_id = viewer_city
        AND role IN ('curator', 'city_leader')
    ) THEN RETURN TRUE; END IF;
    -- Ученики — ТОЛЬКО через куратора своего города (цепочка лидер→куратор→ученик);
    -- city_id самого ученика видимости НЕ даёт (решение Михаила 02.07).
    IF EXISTS (
      SELECT 1 FROM profiles t JOIN profiles c ON c.id = t.curator_id
      WHERE t.id = target_id AND c.city_id = viewer_city
    ) THEN RETURN TRUE; END IF;
    RETURN FALSE;
  END IF;

  IF viewer_role = 'curator' THEN
    IF EXISTS (SELECT 1 FROM profiles WHERE id = target_id AND curator_id = viewer_id) THEN RETURN TRUE; END IF;
    IF EXISTS (SELECT 1 FROM profiles WHERE id = target_id AND role = 'curator' AND city_id = viewer_city) THEN RETURN TRUE; END IF;
    IF EXISTS (SELECT 1 FROM profiles t JOIN profiles c ON c.id = t.curator_id WHERE t.id = target_id AND c.city_id = viewer_city) THEN RETURN TRUE; END IF;
    IF EXISTS (SELECT 1 FROM profiles WHERE id = target_id AND role = 'city_leader' AND city_id = viewer_city) THEN RETURN TRUE; END IF;
    RETURN FALSE;
  END IF;

  SELECT curator_id INTO target_curator FROM profiles WHERE id = target_id;
  IF viewer_curator IS NOT NULL AND viewer_curator = target_curator THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM course_progress cp1 JOIN course_progress cp2 ON cp1.course_id = cp2.course_id WHERE cp1.user_id = viewer_id AND cp1.status = 'completed' AND cp2.user_id = target_id AND cp2.status = 'completed') THEN RETURN TRUE; END IF;
  RETURN FALSE;
END;
$function$;
