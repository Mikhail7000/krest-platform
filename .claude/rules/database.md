---
description: Database safety rules for Supabase PostgreSQL — migrations, RLS, data integrity
globs: ["supabase/**", "**/*schema*", "**/*migration*"]
---

# Правила работы с базой данных

## Миграции — только безопасные

```sql
-- ПРАВИЛЬНО
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS blocks_unlocked INTEGER DEFAULT 1;
CREATE TABLE IF NOT EXISTS uploads (...);

-- НИКОГДА
DROP TABLE student_progress;
ALTER TABLE profiles DROP COLUMN blocks_unlocked;
```

## RLS — всегда включён

- Row Level Security включён на всех таблицах — не отключать
- Студенты видят только свои записи (`auth.uid() = user_id`)
- Лидеры (admin) видят все записи своих студентов
- Не использовать `service_role` key в браузерном коде — только `anon` key

## Бизнес-логика данных

**blocks_unlocked (profiles):**
- Начальное значение: 1
- Изменять только: `blocks_unlocked = blocks_unlocked + 1`
- Максимум: 6 (проверять перед UPDATE)
- Никогда: `blocks_unlocked = 7`, прямое присваивание без проверки

**admin_approved (student_progress):**
- Только лидер ставит `true`
- Только через `UPDATE ... SET admin_approved = true WHERE user_id = ? AND block_id = ? AND lesson_id IS NULL`
- Не через upsert (иначе можно создать дубликат)

**journal_entries:**
- Минимум 20 символов текста перед INSERT
- `submitted_to_leader = true` — только после сохранения

## Дедубликация

Перед INSERT в `student_progress` — проверять наличие записи:
```javascript
const { data: existing } = await _supabase
  .from('student_progress')
  .select('id')
  .eq('user_id', userId)
  .eq('block_id', blockId)
  .is('lesson_id', null)
  .single();
if (!existing) { /* INSERT */ }
```
