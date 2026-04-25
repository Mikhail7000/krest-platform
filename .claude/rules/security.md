---
description: Security rules for CREST platform — XSS prevention, auth guards, Supabase key handling
globs: ["**/*.html", "js/**"]
---

# Правила безопасности

## Ввод данных — XSS защита

```javascript
// СТУДЕНТ вводит текст → только textContent
element.textContent = userInput;  // ПРАВИЛЬНО
element.innerHTML = userInput;    // НИКОГДА для студенческого ввода

// ЛИДЕР создаёт контент → innerHTML допустим
element.innerHTML = leaderContent;  // OK — только лидер создаёт, доверяем
```

## Защита страниц — обязательно

Каждая страница начинается с вызова guard-функции:

```javascript
async function init() {
  const { user, profile } = await requireAuth();    // для студентов
  // или
  const { user, profile } = await requireAdmin();   // для лидеров
  // дальнейшая логика только после успешной проверки
}
```

Исключения (без guard): `login.html`, `index.html` (landing).

## Supabase ключи

- `anon key` в `config.js` — допустимо в браузере (только публичные данные + RLS ограничивает остальное)
- `service_role key` — никогда в браузере, только на сервере
- Не логировать ключи в console.log
- Не коммитить .env файлы с секретами

## Уведомления

```javascript
// ПРАВИЛЬНО
toast('Блок одобрен!', 'success');

// НИКОГДА
alert('Блок одобрен!');
confirm('Удалить?');
prompt('Введите имя');
```

## RLS политики

Supabase RLS защищает данные на уровне базы. Не пытаться обойти через:
- Прямые SQL запросы мимо SDK
- `service_role` key для чтения всех данных
- Отключение RLS на таблицах

Если RLS мешает — изучить политики в `supabase/schema.sql` и добавить нужную политику.
