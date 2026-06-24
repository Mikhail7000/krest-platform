-- Частичные индексы под предикаты гейт-RPC (closed_dates_all / user_closed_days /
-- is_day_closed): аудио-пересказ и видео-местописания фильтруются по passed+medium.
-- Логику не меняют — только ускоряют планировщик при росте числа учеников.
create index if not exists idx_sbr_audio_passed
  on public.student_block_recitations (user_id, block_id)
  where passed and medium = 'audio';

create index if not exists idx_sla_videonote_passed
  on public.student_location_attempts (user_id, location_id)
  where passed and medium = 'video_note';
