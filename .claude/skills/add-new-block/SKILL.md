---
name: add-new-block
description: Add a new CREST learning block with lessons, content, and Bible verses
---

# Скилл: Добавить новый блок КРЕСТ

## Предусловия — спросить пользователя ПЕРЕД работой

**Без этих данных не продолжать:**

1. Название блока на русском и английском
2. Описание блока (1–2 предложения, RU + EN)
3. HTML-конспект блока (RU + EN) или черновик для форматирования
4. YouTube-ссылки для уроков (минимум 1)
5. Стихи Библии: reference (например "Иоанна 3:16") + текст RU + EN

Если что-то из этого не предоставлено — задать вопрос:
> "Для добавления нового блока мне нужен контент. Пожалуйста, предоставьте: [список недостающего]"

## Проверка перед добавлением

```javascript
// Максимум 6 блоков
const { count } = await _supabase
  .from('blocks')
  .select('*', { count: 'exact', head: true });
if (count >= 6) {
  // Нельзя добавить — сообщить пользователю
}
```

## Порядок действий

1. Запросить недостающие данные у пользователя
2. Определить следующий `order_num` (count + 1)
3. INSERT в `blocks` (title_ru, title_en, description_ru, description_en, content_ru, content_en, order_num)
4. INSERT уроки в `lessons` (title_ru, title_en, video_url, content_ru, content_en, block_id, order_num)
5. INSERT стихи в `bible_verses` (reference, text_ru, text_en, lesson_id)
6. Обновить `supabase/content.sql` — добавить новые INSERT
7. Запустить QA Review (run-qa-review скилл)

## SQL-шаблон

```sql
INSERT INTO blocks (order_num, title_ru, title_en, description_ru, description_en, content_ru, content_en)
VALUES (?, '...', '...', '...', '...', '...', '...')
RETURNING id;

INSERT INTO lessons (block_id, order_num, title_ru, title_en, video_url, content_ru, content_en)
VALUES (?, 1, '...', '...', 'https://youtu.be/...', '...', '...');
```

## После создания

- Показать пользователю созданный блок (название, order_num)
- Напомнить запустить миграции если они не были выполнены
- Проверить через `admin/editor.html` что блок отображается корректно
