-- Своя картинка-фон карточки рейтинга (просьба Михаила 2026-06-30).
-- Путь в бакете `avatars` (тот же публичный бакет, что и аватары), отдельный файл.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS leaderboard_bg_path text;
