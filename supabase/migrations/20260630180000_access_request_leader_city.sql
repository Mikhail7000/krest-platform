-- Migration: заявки на доступ — одобрение как лидера города + город
-- Раньше заявку можно было одобрить только как ученика/куратора (без города).
-- Теперь админ/супер-админ из веб-панели может одобрить как:
--   ученик | куратор города | лидер города (с выбором города).
-- approved_role расширяем до city_leader; добавляем approved_city_id, чтобы город
-- применился и при отложенном создании профиля (юзер ещё не открывал бота).

-- 1) Расширяем CHECK на approved_role (инлайн-констрейнт назван автоматически).
alter table public.access_requests
  drop constraint if exists access_requests_approved_role_check;
alter table public.access_requests
  add constraint access_requests_approved_role_check
  check (approved_role in ('student', 'curator', 'city_leader'));

-- 2) Город, выбранный при одобрении (для куратора/лидера). NULL = без города.
alter table public.access_requests
  add column if not exists approved_city_id integer references public.cities(id);
