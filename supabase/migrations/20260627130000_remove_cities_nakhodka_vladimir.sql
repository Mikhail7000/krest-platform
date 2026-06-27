-- Убрать города «Находка» и «Владимир» из платформы (просьба Михаила, 2026-06-27).
-- Обе записи — status='coming_soon' без единого привязанного профиля. Удаляем ТОЛЬКО
-- если к городу не привязан ни один пользователь (защита от потери данных).
-- Единственный FK на cities — profiles.city_id (проверено), поэтому больше ничего
-- не каскадит.
DELETE FROM public.cities c
WHERE c.name_ru IN ('Находка', 'Владимир')
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.city_id = c.id);
