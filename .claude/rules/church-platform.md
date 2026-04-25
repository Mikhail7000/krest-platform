---
description: CREST discipleship platform domain rules — lesson flow, approval logic, content constraints
globs: ["student/lesson.html", "admin/students.html", "js/auth.js"]
---

# Доменные правила платформы КРЕСТ

## Flow урока — строго 7 шагов

Нарушение порядка = нарушение педагогической модели управляемого ученичества.

```
1. Проверить blocks_unlocked >= block.order_num → редирект на дашборд если нет
2. Показать видео (конспект скрыт через display:none)
3. YouTube no-skip: polling каждые 500мс
   if (currentTime > maxWatched + 2) player.seekTo(maxWatched)
4. При watched >= 95% → активировать кнопку форума
5. Форум: минимум 20 символов → сохранить в journal_entries
6. Сохранить в student_progress (admin_approved: false)
7. Показать конспект + кнопка "Следующий" (🔒 до admin_approved = true)
```

## Одобрение лидера

```javascript
// Только UPDATE, не INSERT/upsert
UPDATE student_progress
SET admin_approved = true
WHERE user_id = ? AND block_id = ? AND lesson_id IS NULL

// После одобрения — разблокировать следующий блок
UPDATE profiles
SET blocks_unlocked = LEAST(blocks_unlocked + 1, 6)
WHERE id = ?
```

## Контентные ограничения

- Максимум 6 блоков (order_num 1–6) — это структура курса КРЕСТ
- Каждый блок должен иметь content_ru И content_en
- YouTube видео — обязательны для каждого урока
- Стихи Библии — хранить reference (книга:глава:стих) + текст ru + en

## YouTube no-skip

```javascript
// Polling каждые 500мс
setInterval(() => {
  const current = player.getCurrentTime();
  if (current > maxWatched + 2) {
    player.seekTo(maxWatched);
  } else {
    maxWatched = Math.max(maxWatched, current);
  }
  const duration = player.getDuration();
  if (duration > 0 && maxWatched / duration >= 0.95) {
    // активировать кнопку форума
  }
}, 500);
```

## i18n

- Язык хранится в `localStorage` как `crest_lang` ('ru' | 'en')
- Переводы в `js/config.js` как объект `T = { ru: {...}, en: {...} }`
- Доступ: `const t = T[LANG];` затем `t.someKey`
- Нельзя хардкодить русский или английский текст в HTML/JS
