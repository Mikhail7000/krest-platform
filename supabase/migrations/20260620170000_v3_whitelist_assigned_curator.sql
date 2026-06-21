-- Массовая привязка учеников к куратору. Если ученик ещё не зашёл — куратор
-- запоминается в белом списке и проставится при входе (ensure-profile).
ALTER TABLE public.testing_whitelist
  ADD COLUMN IF NOT EXISTS assigned_curator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
