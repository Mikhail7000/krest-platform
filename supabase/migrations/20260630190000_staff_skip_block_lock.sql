-- Migration: персонал (curator/city_leader/admin/super_admin) → can_skip_block_lock = TRUE
-- Смысл: у кураторов, лидеров городов и админов ВСЕ блоки открыты сразу — они могут
-- свободно листать и перепроходить любой блок сколько угодно раз (без 7-дневного gate,
-- без no-skip на видео, без лимита попыток квиза). Раньше флаг авто-ставился только
-- super_admin. RPC is_block_unlocked и клиент BlockList уже читают can_skip_block_lock —
-- меняем только источник флага.
--
-- Реализация: BEFORE-триггер на profiles ставит TRUE для штатных ролей при любой записи
-- (покрывает все пути: смена роли в панели, одобрение заявки, whitelist-триггер, прямой SQL).
-- Для не-персонала флаг НЕ трогаем (тестировщики-ученики со своим TRUE сохраняются).

create or replace function public.staff_can_skip_block_lock()
returns trigger
language plpgsql
as $$
begin
  if NEW.role in ('curator', 'city_leader', 'admin', 'super_admin') then
    NEW.can_skip_block_lock := true;
  end if;
  return NEW;
end;
$$;

-- Имя с префиксом z_ — чтобы сработать ПОСЛЕ apply_whitelist_role (триггеры одного
-- уровня выполняются по алфавиту имени; так финальная роль уже выставлена).
drop trigger if exists z_staff_can_skip_block_lock on public.profiles;
create trigger z_staff_can_skip_block_lock
  before insert or update on public.profiles
  for each row
  execute function public.staff_can_skip_block_lock();

-- Разовая нормализация существующего персонала.
update public.profiles
  set can_skip_block_lock = true
  where role in ('curator', 'city_leader', 'admin', 'super_admin')
    and can_skip_block_lock is distinct from true;
