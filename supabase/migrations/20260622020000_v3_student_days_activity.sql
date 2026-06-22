-- Поденная активность ученика для панели «Активность».
-- Возвращает по каждому активному дню флаги выполненных практик.
-- Модель закрытого дня = 4 источника: крест + молитва + пересказ(audio) + местописания(video_note).
-- Квиз — справочно (на блок, не в дневной gate). Даты — по UTC (как в остальной системе).

create or replace function public.student_days(p_user_ids uuid[])
returns table(
  user_id uuid,
  d date,
  opened boolean,
  cross_done boolean,
  prayer_done boolean,
  recit_done boolean,
  loc_done boolean,
  quiz_done boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with dates as (
    select a.user_id, a.activity_date d
      from public.student_daily_activity a
      where a.user_id = any(p_user_ids) and a.opened and a.activity_date is not null
    union
    select c.user_id, c.submitted_date
      from public.student_block_daily_cross c where c.user_id = any(p_user_ids)
    union
    select p.user_id, p.prayed_date
      from public.student_block_daily_prayer p where p.user_id = any(p_user_ids)
    union
    select r.user_id, coalesce(r.effective_date, (r.created_at at time zone 'UTC')::date)
      from public.student_block_recitations r
      where r.user_id = any(p_user_ids) and r.medium = 'audio' and r.passed
    union
    select l.user_id, coalesce(l.effective_date, (l.created_at at time zone 'UTC')::date)
      from public.student_location_attempts l
      where l.user_id = any(p_user_ids) and l.medium = 'video_note' and l.passed
    union
    select q.user_id, (q.created_at at time zone 'UTC')::date
      from public.student_quiz_attempts q where q.user_id = any(p_user_ids) and q.passed
  ),
  uniq as (select distinct user_id, d from dates where d is not null)
  select
    u.user_id,
    u.d,
    exists(select 1 from public.student_daily_activity a
           where a.user_id = u.user_id and a.activity_date = u.d and a.opened),
    exists(select 1 from public.student_block_daily_cross c
           where c.user_id = u.user_id and c.submitted_date = u.d),
    exists(select 1 from public.student_block_daily_prayer p
           where p.user_id = u.user_id and p.prayed_date = u.d),
    exists(select 1 from public.student_block_recitations r
           where r.user_id = u.user_id and r.medium = 'audio' and r.passed
             and coalesce(r.effective_date, (r.created_at at time zone 'UTC')::date) = u.d),
    exists(select 1 from public.student_location_attempts l
           where l.user_id = u.user_id and l.medium = 'video_note' and l.passed
             and coalesce(l.effective_date, (l.created_at at time zone 'UTC')::date) = u.d),
    exists(select 1 from public.student_quiz_attempts q
           where q.user_id = u.user_id and q.passed
             and (q.created_at at time zone 'UTC')::date = u.d)
  from uniq u
  order by u.user_id, u.d desc;
$$;

revoke all on function public.student_days(uuid[]) from public;
grant execute on function public.student_days(uuid[]) to service_role;
