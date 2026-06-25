-- ============================================================
-- v3.0 — Хелпер дневного гейта: последняя полностью закрытая дата ученика.
--
-- Дневная модель (канон Михаила 2026-06-25): день учёбы закрывается, когда сданы
-- все 4 практики за ЛОКАЛЬНУЮ дату. Следующий день (и первый день нового блока)
-- открывается только с 00:00 следующих суток по поясу ученика — то есть «действовать
-- сегодня» можно, только если localToday > последней закрытой даты по всему курсу.
--
-- Эта функция возвращает MAX(дата полностью закрытого дня) по ВСЕМ блокам ученика
-- (источник истины — closed_dates_all(), та же логика пересечения 4 практик, что и
-- в user_closed_days / is_block_unlocked). NULL — если ни один день ещё не закрыт.
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_max_closed_date(p_user_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT max(d) FROM public.closed_dates_all() WHERE user_id = p_user_id;
$function$;

REVOKE ALL     ON FUNCTION public.user_max_closed_date(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_max_closed_date(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_max_closed_date(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.user_max_closed_date(uuid) TO service_role;

COMMENT ON FUNCTION public.user_max_closed_date(uuid) IS
  'Дневной гейт: максимальная дата полностью закрытого дня (все 4 практики) по всем блокам ученика. NULL если нет закрытых дней. Используется чтобы новый день/блок открывался только с 00:00 следующих суток.';
