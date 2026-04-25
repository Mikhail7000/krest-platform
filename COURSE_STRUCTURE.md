# COURSE_STRUCTURE.md - Структура курса КРЕСТ

## Обзор

КРЕСТ - курс управляемого ученичества для русскоязычных церквей.
Название - аббревиатура из 5 букв + финальный блок благословений.

## 6 блоков курса

| # | Буква | Тема (RU) | Тема (EN) | Ключевые стихи |
|---|-------|-----------|-----------|----------------|
| 1 | C | Принцип Сотворения | Principle of Creation | Быт 1:27, Быт 2:7, Быт 1:28, Быт 2:16-17, Ин 1:1 |
| 2 | R | Коренная Проблема | Root Problem | Быт 3:1-6, Рим 3:23, Ин 8:44 |
| 3 | E | 6 Состояний Неверующего | Six States of Unbeliever | Еф 2:1-2, Мф 11:28, Дн 8:7, Евр 9:27, Исх 20:4-5 |
| 4 | S | 3 Состояния Мира | Three States of the World | Деяния 4:12, Кол 2:8, Ис 64:6 |
| 5 | T | 3 Работы Христа | Three Works of Christ | Рим 5:8, Ин 14:6, Рим 8:2, 1Ин 3:8, Рим 10:9-10 |
| 6 | + | 7 Благословений Верующего | Seven Blessings of Believer | Ин 1:12, 1Кор 3:16, Ин 14:14, Евр 1:14, Лк 10:19, Фил 3:20, Мф 28:18-20 |

## Расшифровка аббревиатуры

```
К - (C) Creation    - Сотворение
Р - (R) Root        - Коренная проблема  
Е - (E) Six States  - 6 состояний (Еф = E)
С - (S) Three States - 3 состояния мира
Т - (T) Three Works  - 3 работы Христа
+ - 7 Благословений  - Завершающий блок
```

## Flow урока в каждом блоке

```
1. Студент открывает блок (если blocks_unlocked >= order_num)
2. Просмотр видео (no-skip, минимум 95%)
3. Заполнение форума (минимум 20 символов) -> journal_entries
4. Запись в student_progress (admin_approved: false)
5. Показ конспекта
6. Ожидание одобрения лидера
7. После admin_approved: true -> разблокировка следующего блока
```

## Тренажер стихов

После прохождения каждого блока студент может тренировать заучивание
ключевых стихов из таблицы `bible_verses`.

Режимы тренажера:
- Показать reference -> ввести text
- Показать text -> ввести reference
- Flashcards режим

## Роли пользователей

| Роль | Доступ |
|------|--------|
| student | Свой дашборд, свои блоки, тренажер стихов |
| admin (лидер) | Все студенты, одобрение блоков, редактор контента |

## Таблицы базы данных

```
profiles       - пользователи (role, blocks_unlocked)
blocks         - 6 блоков курса (content_ru, content_en)
lessons        - уроки внутри блоков (youtube_url)
bible_verses   - стихи для заучивания (reference, text_ru, text_en)
student_progress - прогресс (user_id, block_id, admin_approved)
journal_entries  - записи форума студентов
```

## Файлы seed-data

```
seed-data/
  blocks/
    01-creation.md      - Блок 1: Сотворение
    02-root-problem.md  - Блок 2: Коренная проблема
    03-six-states.md    - Блок 3: 6 состояний
    04-three-states.md  - Блок 4: 3 состояния мира
    05-three-works.md   - Блок 5: 3 работы Христа
    06-seven-blessings.md - Блок 6: 7 благословений
  verses/
    01-creation-verses.md
    02-root-problem-verses.md
    03-six-states-verses.md
    04-three-states-verses.md
    05-three-works-verses.md
    06-seven-blessings-verses.md

scripts/
  populate-content.mjs - скрипт загрузки в Supabase
```

## Запуск наполнения контента

```bash
SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/populate-content.mjs
```
