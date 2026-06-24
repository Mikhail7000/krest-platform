-- Уведомление куратору, когда ученик закрыл день. Идемпотентность + проверка дня.
create table if not exists public.curator_notify_state (
  id          bigint generated always as identity primary key,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  event_type  text not null,
  event_key   text not null default '',
  created_at  timestamptz not null default now(),
  unique (student_id, event_type, event_key)
);
alter table public.curator_notify_state enable row level security;
grant select, insert on public.curator_notify_state to service_role;

create or replace function public.is_day_closed(p_user_id uuid, p_d date)
returns boolean language sql stable security definer set search_path='' as $$
  with req as (
    select block_id, count(*) req from public.block_locations_to_recite
    where is_required and practice_mode is null group by block_id
  ),
  loc_complete as (
    select lb.block_id from (
      select l.block_id, count(distinct a.location_id) done
      from public.student_location_attempts a
      join public.block_locations_to_recite l on l.id=a.location_id and l.is_required and l.practice_mode is null
      where a.user_id=p_user_id and a.medium='video_note' and a.passed
        and coalesce(a.effective_date,(a.created_at at time zone 'UTC')::date)=p_d
      group by l.block_id
    ) lb join req on req.block_id=lb.block_id and lb.done>=req.req
  )
  select exists (
    select 1 from (
      select block_id, 'cross' src from public.student_block_daily_cross where user_id=p_user_id and submitted_date=p_d
      union all select block_id, 'prayer' from public.student_block_daily_prayer where user_id=p_user_id and prayed_date=p_d
      union all select block_id, 'recv' from public.student_block_recitations where user_id=p_user_id and medium='audio' and passed and coalesce(effective_date,(created_at at time zone 'UTC')::date)=p_d
      union all select block_id, 'loc' from loc_complete
    ) tasks group by block_id having count(distinct src)=4
  );
$$;
revoke all on function public.is_day_closed(uuid,date) from public;
grant execute on function public.is_day_closed(uuid,date) to service_role;
