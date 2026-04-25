---
name: create-migration
description: Создаёт SQL-миграцию для Supabase. Используй когда нужно изменить схему базы данных КРЕСТ.
---

# Скилл: Создать миграцию

## Шаблон файла миграции

Имя файла: `YYYYMMDDHHMMSS_описание.sql`
Сохранять в: `supabase/migrations/`

```sql
-- Описание: что делает эта миграция и зачем

-- Добавить колонку (ОБЯЗАТЕЛЬНО IF NOT EXISTS)
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name TYPE DEFAULT value;

-- Создать таблицу (ОБЯЗАТЕЛЬНО IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- поля
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (если новая таблица)
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
CREATE POLICY "table_select_own" ON table_name
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "table_insert_own" ON table_name
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_table_user_id ON table_name(user_id);

-- Верификация (выполнить после миграции)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'table_name'
ORDER BY ordinal_position;
```

## Обязательные миграции КРЕСТ (выполнить первыми)

```sql
-- Запустить в Supabase Dashboard → SQL Editor
ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS blocks_unlocked INTEGER DEFAULT 1;

-- Верификация
SELECT column_name FROM information_schema.columns
WHERE table_name IN ('student_progress', 'profiles')
ORDER BY table_name, column_name;
```

## Порядок действий

1. Проверить через Context7 синтаксис Supabase (use context7) — если нестандартная операция
2. Написать SQL с IF NOT EXISTS
3. Добавить RLS если новая таблица
4. Добавить индексы для FK и фильтруемых полей
5. Открыть Supabase Dashboard → SQL Editor → выполнить
6. Запустить верификационный SELECT
7. Убедиться COUNT(*) не изменился (данные не потеряны)

## Запрет

- Никогда `DROP TABLE`, `DROP COLUMN` без явного согласования
- Никогда `ALTER TABLE ... ALTER COLUMN` — можно потерять данные
- Всегда `IF NOT EXISTS` для ADD COLUMN и CREATE TABLE
