-- ============================================================
-- v3.0 — Бэкфилл effective_date историческим записям (дневной гейт).
--
-- Дневная модель сравнивает ЛОКАЛЬНУЮ дату ученика (studentLocalToday, пояс города)
-- с датами полностью закрытых дней. Дата закрытого дня для пересказа/местописаний =
-- COALESCE(effective_date, (created_at AT TIME ZONE 'UTC')::date).
--
-- Записи, созданные ДО появления колонки effective_date, имеют effective_date=NULL и
-- падают на UTC-дату created_at. UTC ≠ локальная дата ученика → рассинхрон на границе
-- суток (особенно для поясов западнее UTC): дневной гейт мог бы ошибочно блокировать
-- следующий день. Проставляем локальную дату по поясу города ученика (дефолт Бали
-- Asia/Makassar). Только NULL → идемпотентно и не трогает уже корректные записи.
--
-- После бэкфилла ВСЕ записи имеют локальную effective_date → COALESCE всегда берёт её,
-- сравнение с localToday становится консистентным для всех учеников (текущих и будущих).
-- ============================================================

UPDATE public.student_block_recitations r
   SET effective_date = (r.created_at AT TIME ZONE COALESCE(c.timezone, 'Asia/Makassar'))::date
  FROM public.profiles p
  LEFT JOIN public.cities c ON c.id = p.city_id
 WHERE r.user_id = p.id
   AND r.effective_date IS NULL;

UPDATE public.student_location_attempts a
   SET effective_date = (a.created_at AT TIME ZONE COALESCE(c.timezone, 'Asia/Makassar'))::date
  FROM public.profiles p
  LEFT JOIN public.cities c ON c.id = p.city_id
 WHERE a.user_id = p.id
   AND a.effective_date IS NULL;
