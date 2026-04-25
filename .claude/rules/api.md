---
description: Правила для работы с Supabase JS SDK — запросы, авторизация, обработка ошибок
globs: ["js/**", "student/**/*.html", "admin/**/*.html"]
---

# Правила работы с Supabase JS SDK

## Клиент — только из config.js

```javascript
// Клиент доступен как глобальная переменная _supabase (инициализирован в config.js)
// НЕ создавать новый клиент в каждом файле
const { data, error } = await _supabase.from('blocks').select('*');
```

## Авторизация на каждом запросе

- RLS автоматически фильтрует данные по `auth.uid()`
- Не передавать `user_id` вручную в WHERE — RLS уже делает это
- Для admin-операций: проверить `profile.role === 'admin'` в JS перед запросом

## Обработка ошибок

```javascript
const { data, error } = await _supabase.from('table').select('*');
if (error) {
  console.error(error);
  toast('Ошибка загрузки данных', 'error');
  return; // всегда ранний return при ошибке
}
// дальнейшая логика только если нет ошибки
```

## Паттерны запросов

```javascript
// SELECT с фильтром
const { data } = await _supabase
  .from('student_progress')
  .select('*')
  .eq('user_id', userId)
  .eq('block_id', blockId)
  .single();

// INSERT
const { error } = await _supabase
  .from('journal_entries')
  .insert({ user_id: userId, block_id: blockId, content: text });

// UPDATE (не upsert для admin_approved)
const { error } = await _supabase
  .from('student_progress')
  .update({ admin_approved: true })
  .eq('user_id', userId)
  .eq('block_id', blockId)
  .is('lesson_id', null);
```

## Запрет

- Не использовать `.upsert()` для `admin_approved` — только `.update()`
- Не делать запросы без проверки `error`
- Не логировать данные пользователей в `console.log` в продакшне
