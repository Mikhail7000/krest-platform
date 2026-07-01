-- Харднинг профилей (2026-07-02):
-- 1) Аудит ВСЕХ смен ролей на уровне БД (спека: «все изменения роли → role_change_log»).
--    Раньше логировал только панельный роут actions/role — мимо шли: повышение через
--    whitelist (actions/add, бот /addcurator, /addleader), одобрение заявки, триггер
--    apply_whitelist_role, прямой SQL. Панельная запись (с актором) остаётся —
--    триггерная строка дублирует её с changed_by=NULL (актор БД неизвестен).
-- 2) Защита привилегированных колонок profiles от записи RLS-клиентом (authenticated):
--    легаси-политика "update own profile" не ограничивает колонки — из браузера своей
--    сессией можно было поменять себе role/curator_id/city_id. Серверные пути
--    (service_role) не затрагиваются.

-- 1) changed_by → nullable: NULL = смена вне панели (триггер БД, актор неизвестен).
ALTER TABLE public.role_change_log ALTER COLUMN changed_by DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.role_change_log (changed_user_id, old_role, new_role, changed_by, reason)
  VALUES (NEW.id, OLD.role, NEW.role, NULL, 'db:trigger');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_log_role_change ON public.profiles;
-- Без «OF role»: BEFORE-триггер apply_whitelist_role меняет NEW.role даже когда
-- UPDATE-запрос колонку role не трогал — «OF role» такой случай пропустил бы.
CREATE TRIGGER zz_log_role_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.log_role_change();

-- 2) Привилегированные колонки может писать только сервер (service_role / SQL).
--    Префикс a_ — триггер идёт ПЕРВЫМ (до trg_apply_whitelist_role и z_staff_*),
--    т.е. проверяет исходные значения клиента, а не результат работы других триггеров.
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'authenticated' THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.curator_id IS DISTINCT FROM OLD.curator_id
       OR NEW.city_id IS DISTINCT FROM OLD.city_id
       OR NEW.is_whitelisted IS DISTINCT FROM OLD.is_whitelisted
       OR NEW.is_protected IS DISTINCT FROM OLD.is_protected
       OR NEW.owner_locked IS DISTINCT FROM OLD.owner_locked
       OR NEW.can_skip_block_lock IS DISTINCT FROM OLD.can_skip_block_lock
       OR NEW.telegram_chat_id IS DISTINCT FROM OLD.telegram_chat_id
       OR NEW.hidden_from_tracking IS DISTINCT FROM OLD.hidden_from_tracking
    THEN
      RAISE EXCEPTION 'privileged profile columns are server-managed'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_protect_privileged_columns ON public.profiles;
CREATE TRIGGER a_protect_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_privileged_profile_columns();
