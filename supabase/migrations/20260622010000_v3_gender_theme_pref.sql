-- Розовая тема для девочек: пол + явное предпочтение темы.
-- Оба поля опциональны, подаются как «оформление», логику курса не затрагивают.
-- ADD CONSTRAINT не имеет IF NOT EXISTS → оборачиваем в DO/EXCEPTION (идемпотентно).

alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists theme_pref text;

do $$ begin
  alter table public.profiles add constraint profiles_gender_chk
    check (gender is null or gender in ('female', 'male'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_theme_pref_chk
    check (theme_pref is null or theme_pref in ('light', 'dark', 'stars', 'pink'));
exception when duplicate_object then null; end $$;

comment on column public.profiles.gender is
  'Пол (опц.): female|male. Только для оформления (розовая тема), не влияет на логику курса.';
comment on column public.profiles.theme_pref is
  'Явный выбор темы: light|dark|stars|pink. Перекрывает авто-по-полу.';
