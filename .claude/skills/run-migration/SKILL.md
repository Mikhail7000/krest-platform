---
name: run-migration
description: Safe database migration workflow for Supabase — always IF NOT EXISTS, verify after
---

# Скилл: Запустить миграцию базы данных

## Принцип безопасности

Все миграции — только аддитивные. Никогда не удалять столбцы или таблицы без явного согласования.

## Шаблон любой миграции

```sql
-- Добавить колонку (если не существует)
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name TYPE DEFAULT value;

-- Создать таблицу (если не существует)
CREATE TABLE IF NOT EXISTS table_name (...);

-- Создать индекс (если не существует)
CREATE INDEX IF NOT EXISTS idx_name ON table_name(column);

-- Верификация после миграции
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'table_name'
ORDER BY ordinal_position;
```

## Обязательные миграции КРЕСТ

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

1. Открыть Supabase Dashboard → SQL Editor
2. Проверить через Context7 синтаксис (если нестандартная миграция)
3. Вставить SQL и выполнить
4. Запустить верификационный SELECT
5. Убедиться что ни одна строка не потеряна через COUNT(*)

## Перед работой

Запроси актуальную документацию через Context7 MCP если миграция нестандартная (новые типы данных, партиционирование, кастомные функции).
