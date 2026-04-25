# SUPABASE_SCHEMA.md — Схема базы данных КРЕСТ

> Справочник по таблицам. Актуальный SQL — в `supabase/schema.sql`.

---

## Таблицы (7 штук)

```
profiles          → данные пользователей (расширение auth.users)
blocks            → 6 блоков курса КРЕСТ
lessons           → уроки внутри блоков (видео)
student_progress  → прогресс студентов по блокам
journal_entries   → ответы студентов (форум)
bible_verses      → стихи Библии для тренажёра
uploads           → загруженные файлы
```

---

## profiles

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  full_name       TEXT,
  role            TEXT DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  blocks_unlocked INTEGER DEFAULT 1,          -- текущий разблокированный блок (1–6)
  telegram_chat_id BIGINT,                    -- для Telegram уведомлений
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Правила:**
- `blocks_unlocked`: только +1, максимум 6, `LEAST(blocks_unlocked + 1, 6)`
- `role`: только 'student' или 'admin'
- `telegram_chat_id`: NULL если студент не привязал Telegram

---

## blocks

```sql
CREATE TABLE IF NOT EXISTS blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_num   INTEGER NOT NULL UNIQUE CHECK (order_num BETWEEN 1 AND 6),
  title_ru    TEXT NOT NULL,
  title_en    TEXT NOT NULL,
  content_ru  TEXT NOT NULL,   -- HTML конспект на русском
  content_en  TEXT NOT NULL,   -- HTML конспект на английском
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Правила:**
- Ровно 6 блоков (order_num 1–6)
- Оба языковых поля обязательны

---

## lessons

```sql
CREATE TABLE IF NOT EXISTS lessons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id    UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  order_num   INTEGER NOT NULL,
  title_ru    TEXT NOT NULL,
  title_en    TEXT NOT NULL,
  youtube_url TEXT NOT NULL,   -- полный URL или ID видео YouTube
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (block_id, order_num)
);
```

---

## student_progress

```sql
CREATE TABLE IF NOT EXISTS student_progress (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_id       UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  lesson_id      UUID REFERENCES lessons(id) ON DELETE CASCADE,  -- NULL = прогресс по блоку
  admin_approved BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, block_id, lesson_id)
);
```

**Правила:**
- `lesson_id IS NULL` — запись об одобрении блока (главная)
- `admin_approved = true` — только лидер через UPDATE, не INSERT/upsert
- Проверять дубликат перед INSERT

---

## journal_entries

```sql
CREATE TABLE IF NOT EXISTS journal_entries (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_id             UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  content              TEXT NOT NULL CHECK (length(content) >= 20),
  submitted_to_leader  BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
```

**Правила:**
- Минимум 20 символов (CHECK на уровне БД + валидация в JS)
- Лидер читает через RLS (видит все записи студентов)

---

## bible_verses

```sql
CREATE TABLE IF NOT EXISTS bible_verses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id    UUID REFERENCES blocks(id) ON DELETE CASCADE,
  reference   TEXT NOT NULL,   -- например: "Иоанна 3:16"
  text_ru     TEXT NOT NULL,
  text_en     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## uploads

```sql
CREATE TABLE IF NOT EXISTS uploads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  url         TEXT NOT NULL,
  block_id    UUID REFERENCES blocks(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## RLS Политики (сводка)

| Таблица | Студент | Лидер (admin) |
|---------|---------|---------------|
| profiles | SELECT, UPDATE свои | SELECT все |
| blocks | SELECT (публично) | SELECT, INSERT, UPDATE |
| lessons | SELECT (публично) | SELECT, INSERT, UPDATE |
| student_progress | SELECT свои, INSERT свои | SELECT все, UPDATE admin_approved |
| journal_entries | SELECT, INSERT свои | SELECT все |
| bible_verses | SELECT (публично) | SELECT, INSERT, UPDATE |
| uploads | SELECT, INSERT, DELETE свои | SELECT все |

---

## Миграции (применены)

```
20260423_add_admin_approved.sql
  ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN DEFAULT FALSE;

20260423_add_blocks_unlocked.sql
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS blocks_unlocked INTEGER DEFAULT 1;

20260423_add_telegram_chat_id.sql
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
```

---

## Быстрые запросы

```javascript
// Студент — загрузить блок с уроками
const { data: block } = await _supabase
  .from('blocks')
  .select('*, lessons(*)')
  .eq('order_num', blockNum)
  .single();

// Лидер — студенты ожидающие одобрения
const { data: pending } = await _supabase
  .from('student_progress')
  .select('*, profiles!user_id(*), blocks!block_id(*), journal_entries!inner(*)')
  .eq('admin_approved', false)
  .is('lesson_id', null);

// Одобрить блок
await _supabase
  .from('student_progress')
  .update({ admin_approved: true })
  .eq('user_id', studentId)
  .eq('block_id', blockId)
  .is('lesson_id', null);

// Разблокировать следующий блок
await _supabase
  .from('profiles')
  .update({ blocks_unlocked: supabase.rpc('increment_blocks', { uid: studentId }) });
```
