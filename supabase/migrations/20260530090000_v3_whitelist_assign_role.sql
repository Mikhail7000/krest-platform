-- Автоназначение роли по вайтлисту: тестировщики получают role=curator
-- при первом входе (когда профиль создаётся/обновляется с contact_info=@username).
alter table public.testing_whitelist add column if not exists assign_role text;

update public.testing_whitelist set assign_role = 'curator'
where lower(telegram_username) in (
  '@elyaforlife','@iponomaryov','@noginskai','@arskuz','@matthew_888_rus','@evtsikhevich',
  '@alferev','@aleksa_pentina','@alex_magnier','@stepanperm','@vvvlasovvvaa','@ser_go22'
);

create or replace function public.apply_whitelist_role()
returns trigger
language plpgsql
as $$
declare wr text;
begin
  if NEW.contact_info is not null then
    select assign_role into wr
    from public.testing_whitelist
    where lower(telegram_username) = lower(NEW.contact_info)
    limit 1;
    -- только повышаем student → назначенная роль; admin/super_admin/curator не трогаем
    if wr is not null and NEW.role = 'student' then
      NEW.role := wr;
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_apply_whitelist_role on public.profiles;
create trigger trg_apply_whitelist_role
before insert or update on public.profiles
for each row execute function public.apply_whitelist_role();
