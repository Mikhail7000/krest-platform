-- Активировать все города (для онбординга)
-- Позволяет ученикам выбирать города при регистрации вместо "coming_soon"

UPDATE cities SET status = 'active' WHERE status = 'coming_soon';
