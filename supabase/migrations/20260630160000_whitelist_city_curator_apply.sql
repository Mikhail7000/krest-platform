-- Фаза 3 ролей: добавленные лидером города кураторы/ученики должны попадать в его
-- город (и к нужному куратору). Whitelist получает assigned_city_id; триггер
-- apply_whitelist_role при входе ставит профилю не только роль, но и город/куратора.

ALTER TABLE public.testing_whitelist ADD COLUMN IF NOT EXISTS assigned_city_id integer;

CREATE OR REPLACE FUNCTION public.apply_whitelist_role()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE wr text; wcity integer; wcur uuid;
BEGIN
  IF NEW.contact_info IS NOT NULL THEN
    SELECT assign_role, assigned_city_id, assigned_curator_id
      INTO wr, wcity, wcur
    FROM public.testing_whitelist
    WHERE lower(telegram_username) = lower(NEW.contact_info)
    LIMIT 1;

    -- роль: только повышаем student → назначенную (admin/super_admin/curator/city_leader не понижаем)
    IF wr IS NOT NULL AND NEW.role = 'student' THEN
      NEW.role := wr;
    END IF;
    -- город: назначенный лидером/админом город приоритетнее (лидер ведёт свой город)
    IF wcity IS NOT NULL THEN
      NEW.city_id := wcity;
    END IF;
    -- куратор: привязка к назначенному куратору, если ученик ещё не привязан
    IF wcur IS NOT NULL AND NEW.curator_id IS NULL THEN
      NEW.curator_id := wcur;
    END IF;
  END IF;
  RETURN NEW;
END $function$;
