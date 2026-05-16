# SPEC: AI-first flow — блоки 1-10 без куратора

> Версия: 1.1 | Дата: 2026-05-09 | Автор: Claude (по ТЗ Михаила от 2026-05-07, уточнения от 2026-05-09)
>
> Этот документ описывает **новый поток ученика по блокам 1-10**, в котором AI-агенты заменяют куратора на этапе подготовки. Куратор остаётся ТОЛЬКО для финального экзамена курса (личная встреча, реализация позже).
>
> Связано: `memory/project_new_flow_ai_first.md`, `HANDOVER.md` v11.0, `SPEC.md` v3.0, `docs/spec-first/03-block1-maly-krest.md` (часть актуальна, часть переосмыслена).
>
> **Изменения v1.1 (2026-05-09):** §0-§7 одобрены Михаилом без правок. По §8 утверждены 10 решений — см. новый §10 «Принятые решения и константы». §3 уточнён под новые лимиты. §1.3 и §3.5 описывают `course_intro_video` как отдельную сущность.

---

## 0. Контекст и цель

### 0.1 Откуда взялось

2026-05-07 Алекс (преподаватель курса) согласовал с Михаилом переориентацию проекта:

- **Telegram-first.** Веб-версия второстепенна.
- **AI заменяет куратора в блоках 1-10.** Каждый пункт ДЗ внутри блока auto-approve через AI.
- **Куратор включается только в финале** — личная встреча после прохождения 10 блоков и финального AI-теста.

Цель — **разгрузить куратора от рутины** (одобрение каждого видео, конспекта, местописания) и **масштабировать платформу**: один куратор сможет вести больше учеников.

### 0.2 Чем НЕ занимаемся в этой спеке

- Финальный личный экзамен с куратором (Этап 6 — потом).
- Веб-админка для редактирования квизов и эталонов местописаний (отдельная задача).
- Многоязычность — на старте только `ru`.
- Восстановление куратор-первого потока (он dormant, но не удаляем).

### 0.3 Что остаётся dormant (НЕ сносим)

| Сущность | Зачем оставляем |
|---|---|
| `profiles.curator_id` | Связь ученик↔куратор для финального экзамена |
| `is_visible_to(viewer, target)` | RLS на `profiles`, `course_progress`, `daily_activity` |
| `submissions`, `assignments` (12-пунктовая модель) | Возможный возврат для finale + legacy данные |
| `course_progress`, `role_change_log`, `is_protected` | Мультикурсовая архитектура и аудит |

Новый поток **дополняет**, а не заменяет существующую схему.

---

## 1. Поток ученика по блоку (state machine)

### 1.1 Общая диаграмма

```
[ Вступление (1 раз перед Блоком 1) ]
   ↓ no-skip ≥95% по course_intro_video (отдельная сущность, см. §1.3 и §3.8)
   ↓
┌─ Блок N ─────────────────────────────────────────────┐
│                                                      │
│  not_started                                         │
│      ↓ ученик открыл блок                            │
│  video_watching                                      │
│      ↓ no-skip overlay, ≥95% по main_video           │
│      ↓ (если есть additional_video — тоже ≥95%)      │
│  summary_reading                                     │
│      ↓ ученик пролистал AI-сгенерированный конспект  │
│      ↓ нажал «Прошёл конспект»                       │
│  quiz_pending                                        │
│      ↓ AI Sonnet (один раз) сгенерил вопросы         │
│      ↓ ученик отвечает (галочки + свободный текст)   │
│      ↓ AI Haiku проверяет → pass/fail                │
│  quiz_passed                                         │
│      ↓                                               │
│  locations_pending                                   │
│      ↓ ученик в @cross_bot шлёт video_note/voice     │
│      ↓ Whisper → текст → Haiku сравнение с эталоном  │
│      ↓ все местописания блока приняты                │
│  locations_passed                                    │
│      ↓ автоматический triggerCheck                   │
│  block_completed   ← unlock следующего блока         │
└──────────────────────────────────────────────────────┘
   ↓
[ После Блока 5 ] → ⭐ Mid AI-экзамен (тот же формат, что quiz, но по блокам 1-5)
   ↓
[ После Блока 10 ] → ⭐⭐⭐ Final AI-экзамен (по всему курсу)
   ↓
[ Экран /m/completed ] → «Поздравляем, вы прошли курс КРЕСТ»
   ↓
[ 🎓 Финальный экзамен с куратором — реализация позже ]
```

### 1.2 Статусы блока (`student_block_progress.status`)

| Статус | Что значит | Как переходит дальше |
|---|---|---|
| `not_started` | Ученик ещё не открывал | Открыл блок → `video_watching` |
| `video_watching` | Смотрит main/additional video | Все required видео `video_watch_progress.completed_at IS NOT NULL` → `summary_reading` |
| `summary_reading` | Читает AI-конспект | Кнопка «Прошёл конспект» → `quiz_pending` |
| `quiz_pending` | Тест предложен или в процессе | AI Haiku агрегировал score ≥ `BLOCK_QUIZ_PASS_PCT` (75%) → `quiz_passed`. Если ниже → попытка засчитана, ученик может повторить. После `MAX_QUIZ_ATTEMPTS=3` неудач — 24-часовая пауза (поле `quiz_locked_until`) |
| `quiz_passed` | Тест сдан, идёт к местописаниям | Автоматически → `locations_pending` |
| `locations_pending` | Шлёт video_note/voice через бот | Все местописания блока приняты → `locations_passed` |
| `locations_passed` | Местописания приняты | Автоматически → `block_completed` |
| `block_completed` | Блок закрыт | Unlock `student_block_progress` для следующего блока |

Промежуточный AI-экзамен (после Блока 5) и финальный (после Блока 10) — отдельные сущности, см. §1.3.

### 1.3 Промежуточный и финальный AI-экзамены

**Mid-exam:** триггерится после `block_completed` для Блока 5. Формат — тот же, что блочный квиз, но:
- Источник вопросов — `block_quiz_questions` всех блоков 1-5 (отбираем по 2-3 вопроса с каждого блока через `is_mid_exam=TRUE` или генерим отдельный набор).
- Хранится отдельно: `student_exam_progress` (см. §3.4).
- Pass-критерий — `MID_EXAM_PASS_PCT = 80%`.

**Final exam:** триггерится после `block_completed` для Блока 10. Источник — все блоки 1-10 (`is_final_exam=TRUE`). Pass-критерий — `FINAL_EXAM_PASS_PCT = 85%` (минимум). Pass → запись в `course_progress.status='completed'` для курса КРЕСТ, открывает курс «10 писем» (`status='unlocked'`).

**Лимиты попыток для экзаменов** — те же, что блочный квиз: 3 попытки, потом 24-часовая пауза.

**Вступление перед Блоком 1** — отдельная сущность `course_intro_video` (см. §3.8), не путать с `additional_video` Блока 1. Пройти один раз ≥95% no-skip перед открытием Блока 1.

### 1.4 Граничные случаи

| Ситуация | Поведение |
|---|---|
| AI Sonnet вернул невалидный JSON при генерации квиза | Retry 2 раза → если всё ещё fail → лог в `ai_call_log`, статус `quiz_pending` остаётся, админ должен сгенерить вручную через скрипт |
| Whisper упал (timeout/quota) | Telegram бот пишет ученику «Не получилось расшифровать, отправь ещё раз». Лог в `ai_call_log`. |
| Ученик 3 раза провалил квиз | После 3-й неудачи `quiz_locked_until = NOW() + 24h`. UI показывает «Возвращайся через 24 часа». Можно дать кнопку «Вернуться к конспекту». |
| AI Haiku посчитал свободный текст «нет совпадения» при местописании | Ученик переотправляет. Сохраняем все попытки в `student_location_attempts`. Лимит попыток местописания — те же 3 + 24h пауза (поле `locations_locked_until`) |
| Видео упало с Kinescope | `KinescopePlayerNoSkip` показывает ошибку, ретрай через перезагрузку — без изменений со стороны AI |
| Ученик удалил Telegram-аккаунт | Прогресс остаётся в БД (FK `ON DELETE CASCADE` есть, но логически — `profiles.is_deleted=TRUE` будет добавлено отдельной задачей, сейчас не делаем) |

---

## 2. Архитектурные решения (повтор для удобства)

| # | Решение | Источник |
|---|---|---|
| 1 | UI гибрид: основа в MiniApp `/m/*`, video_note/voice через бот | ТЗ 2026-05-07 |
| 2 | OpenAI Whisper (audio→text) + Anthropic Claude (Sonnet generate / Haiku check) | ТЗ 2026-05-07 |
| 3 | Эталоны местописаний — захардкожены в миграции `block_locations_to_recite`, Михаил пришлёт точные стихи | ТЗ 2026-05-07 |
| 4 | Тест-вопросы — Sonnet генерит один раз → `block_quiz_questions` → ручное редактирование | ТЗ 2026-05-07 |
| 5 | Куратор полностью убран из UI и потока для блоков 1-10 | ТЗ 2026-05-07 |
| 6 | Вступление = `additional_video` Блока 1 «Вводный урок» (Kinescope `ntfUqbL89b9mrGzrgKrLbW`) | ТЗ 2026-05-07 |

---

## 3. Схема новых таблиц (DDL-наброски)

> Это **черновики**. Точные имена колонок и индексы финализируются на этапе миграций (Этап 1, шаг 2). Здесь — для согласования логики.

### 3.1 `block_quiz_questions`

Вопросы теста по блоку. Генерируются Sonnet один раз, потом редактируются вручную.

```sql
CREATE TABLE IF NOT EXISTS block_quiz_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id        INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  question_type   TEXT NOT NULL CHECK (question_type IN (
                    'single_choice',   -- галочка из N вариантов
                    'multi_choice',    -- несколько галочек из N
                    'free_text'        -- свободный текст
                  )),
  question_text   TEXT NOT NULL,
  -- Для single/multi_choice — массив вариантов и индексы правильных:
  options         JSONB,               -- ["вариант 1", "вариант 2", ...]  | NULL для free_text
  correct_indices INTEGER[],           -- [0, 2]  | NULL для free_text
  -- Для free_text — что AI Haiku должен искать в ответе:
  expected_answer TEXT,                -- эталонный смысл (не дословное совпадение) | NULL для choice
  rubric          TEXT,                -- инструкция для Haiku: «приемлемо если ученик упомянул X и Y»
  order_index     INTEGER NOT NULL DEFAULT 1,
  is_mid_exam     BOOLEAN NOT NULL DEFAULT FALSE,   -- включить в промежуточный экзамен
  is_final_exam   BOOLEAN NOT NULL DEFAULT FALSE,   -- включить в финальный
  generated_by_ai BOOLEAN NOT NULL DEFAULT TRUE,
  edited_manually BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bqq_block ON block_quiz_questions(block_id, order_index);
CREATE INDEX IF NOT EXISTS idx_bqq_mid   ON block_quiz_questions(block_id) WHERE is_mid_exam;
CREATE INDEX IF NOT EXISTS idx_bqq_final ON block_quiz_questions(block_id) WHERE is_final_exam;

ALTER TABLE block_quiz_questions ENABLE ROW LEVEL SECURITY;
-- SELECT всем authenticated, ALL только admin (как block_resources)
```

**Открытый вопрос:** держать ли `options` в JSONB или вынести в отдельную таблицу `block_quiz_options`? JSONB проще, но менее гибко для редактирования. **Предлагаю JSONB** — проще, для MVP достаточно.

### 3.2 `block_locations_to_recite`

Эталоны местописаний и притч для пересказа.

```sql
CREATE TABLE IF NOT EXISTS block_locations_to_recite (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id      INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  reference     TEXT NOT NULL,           -- «Евреям 9:27» | «Луки 16:19-31»
  exact_text    TEXT NOT NULL,           -- точный текст синодального перевода
  check_mode    TEXT NOT NULL DEFAULT 'verbatim'
                CHECK (check_mode IN ('verbatim', 'meaning')),
                -- verbatim — слово-в-слово (короткий стих, заучивание)
                -- meaning — пересказать суть своими словами (притча)
  is_required   BOOLEAN NOT NULL DEFAULT TRUE,
                -- FALSE: стих показывается ученику в блоке «для понимания», AI не проверяет, сдача не требуется
                -- (например Бытие 1:28 в Блоке 2 — расширенный разбор, info-only)
  order_index   INTEGER NOT NULL DEFAULT 1,
  similarity_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.85,
                -- для verbatim — порог сходства транскрипта с exact_text
                -- для meaning — порог «полноты» пересказа (по рубрике)
  rubric        TEXT,
                -- для meaning: «должен упомянуть богача, Лазаря, ад/мучения, пропасть, что братья не поверят…»
                -- для verbatim — может быть NULL
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(block_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_blr_block ON block_locations_to_recite(block_id, order_index);

ALTER TABLE block_locations_to_recite ENABLE ROW LEVEL SECURITY;
-- SELECT всем authenticated, ALL только admin
```

**Два режима AI-проверки:**

1. **`verbatim`** — короткий стих, ученик читает слово-в-слово. AI Haiku считает similarity transcript ↔ exact_text. Пример: Евреям 9:27, Иоанна 19:30, Луки 17:21.
2. **`meaning`** — длинная притча, ученик пересказывает суть. AI Haiku по `rubric` проверяет, упомянул ли все ключевые элементы. Пример: Луки 16:19-31 (Богач и Лазарь, 13 предложений — заучить нереально, а суть знать обязательно).

Промпты Haiku в обоих случаях разные — см. §4.5.

### 3.3 `student_block_progress`

Главная таблица — статус прохождения блока учеником.

```sql
CREATE TABLE IF NOT EXISTS student_block_progress (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_id            INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
                        'not_started',
                        'video_watching',
                        'summary_reading',
                        'quiz_pending',
                        'quiz_passed',
                        'locations_pending',
                        'locations_passed',
                        'block_completed'
                      )),
  videos_completed_at      TIMESTAMPTZ,
  summary_acknowledged_at  TIMESTAMPTZ,
  quiz_passed_at           TIMESTAMPTZ,
  quiz_attempts            INTEGER NOT NULL DEFAULT 0,
  last_quiz_score_pct      INTEGER,            -- 0..100
  quiz_locked_until        TIMESTAMPTZ,        -- NOT NULL после 3-й неудачной попытки → ждём 24h
  locations_passed_at      TIMESTAMPTZ,
  locations_attempts       INTEGER NOT NULL DEFAULT 0,
  locations_locked_until   TIMESTAMPTZ,        -- та же логика для местописаний
  block_completed_at       TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at               TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, block_id)
);

CREATE INDEX IF NOT EXISTS idx_sbp_user      ON student_block_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_sbp_block     ON student_block_progress(block_id);
CREATE INDEX IF NOT EXISTS idx_sbp_completed ON student_block_progress(user_id) WHERE status = 'block_completed';

ALTER TABLE student_block_progress ENABLE ROW LEVEL SECURITY;
-- SELECT: свой + visible + admin
-- INSERT/UPDATE: только через API route (service_role) после валидации Telegram initData
-- DELETE: только admin
```

### 3.4 `student_exam_progress` (для mid и final)

```sql
CREATE TABLE IF NOT EXISTS student_exam_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam_type       TEXT NOT NULL CHECK (exam_type IN ('mid', 'final')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                    'pending', 'in_progress', 'passed', 'failed'
                  )),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_score_pct  INTEGER,
  exam_locked_until TIMESTAMPTZ,            -- 24h-пауза после 3-й неудачной
  passed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, exam_type)
);
```

### 3.5 `student_quiz_attempts`

Лог попыток квиза (для отладки и истории).

```sql
CREATE TABLE IF NOT EXISTS student_quiz_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_id        INTEGER REFERENCES blocks(id) ON DELETE CASCADE,        -- NULL для exam
  exam_type       TEXT CHECK (exam_type IS NULL OR exam_type IN ('mid', 'final')),
  answers         JSONB NOT NULL,    -- {question_id: {answer: "..." | [0,2], ai_verdict: "pass"|"fail", ai_comment: "..."}}
  score_pct       INTEGER NOT NULL,
  passed          BOOLEAN NOT NULL,
  ai_call_id      UUID,              -- ссылка на ai_call_log
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

### 3.6 `student_location_attempts`

Лог попыток местописаний. Файлы video_note/voice **храним** в Supabase Storage (новый bucket `student-recitations`, private, RLS: ученик видит свои + admin видит все).

```sql
CREATE TABLE IF NOT EXISTS student_location_attempts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id           UUID NOT NULL REFERENCES block_locations_to_recite(id) ON DELETE CASCADE,
  telegram_message_id   BIGINT,                -- ID сообщения в Telegram (на случай повторного скачивания)
  source_type           TEXT NOT NULL CHECK (source_type IN ('video_note', 'voice')),
  storage_path          TEXT NOT NULL,         -- 'student-recitations/<user_id>/<location_id>/<attempt_id>.mp4|.ogg'
  file_size_bytes       INTEGER,
  duration_seconds      NUMERIC(6,2),
  transcript            TEXT,                  -- результат Whisper
  similarity_score      NUMERIC(4,3),          -- 0.000..1.000
  passed                BOOLEAN NOT NULL,
  ai_comment            TEXT,                  -- что Haiku сказал
  ai_call_id            UUID,
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

Storage bucket создаётся той же миграцией, что и таблица:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-recitations', 'student-recitations', false)
ON CONFLICT (id) DO NOTHING;
-- + RLS-политики: ученик читает/пишет свою папку <user_id>/, admin — всё
```

### 3.7 `ai_call_log`

Аудит всех AI-вызовов (для отладки и расходов).

```sql
CREATE TABLE IF NOT EXISTS ai_call_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai')),
  model           TEXT NOT NULL,            -- 'claude-sonnet-4-6' | 'claude-haiku-4-5' | 'whisper-1'
  purpose         TEXT NOT NULL CHECK (purpose IN (
                    'generate_quiz', 'check_quiz_answer',
                    'transcribe_audio', 'compare_location',
                    'summarize_transcript'
                  )),
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  duration_ms     INTEGER,
  success         BOOLEAN NOT NULL,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

### 3.8 `course_intro_video` (новая сущность)

Вступление перед курсом — отдельная сущность, не привязана к Блоку 1.

```sql
CREATE TABLE IF NOT EXISTS course_intro_video (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_slug   TEXT NOT NULL UNIQUE REFERENCES courses(slug) ON DELETE CASCADE,
  title_ru      TEXT NOT NULL,
  description_ru TEXT,
  kinescope_id  TEXT NOT NULL,        -- для курса КРЕСТ на старте: 'ntfUqbL89b9mrGzrgKrLbW'
  duration_sec  INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE course_intro_video ENABLE ROW LEVEL SECURITY;
-- SELECT всем authenticated, ALL только admin
```

Прогресс просмотра — переиспользуем существующую `video_watch_progress`, но добавим колонку `course_intro_video_id` (nullable, mutually exclusive с `block_resource_id`) ИЛИ создадим отдельную `student_intro_progress`. **Предлагаю отдельную таблицу** — чище, не ломает существующую FK на `block_resources`:

```sql
CREATE TABLE IF NOT EXISTS student_intro_progress (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  intro_video_id      UUID NOT NULL REFERENCES course_intro_video(id) ON DELETE CASCADE,
  max_watched_seconds INTEGER NOT NULL DEFAULT 0 CHECK (max_watched_seconds >= 0),
  total_seconds       INTEGER,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, intro_video_id)
);
```

**Решение по дублю «Вводного урока» (Михаил, 2026-05-09):** **гибрид (в)** — запись остаётся в `block_resources` для Блока 1, но переключается в `is_required = FALSE`. Перед Блоком 1 единственное обязательное вступление — `course_intro_video`. Из карточки Блока 1 ученик может пересмотреть Вводный урок добровольно. В миграции `course_intro_video` будет `UPDATE block_resources SET is_required = FALSE WHERE block_id = 1 AND resource_type = 'additional_video'`.

---

## 4. AI-контракты

### 4.1 Генерация конспекта из транскрипта (Sonnet, один раз на блок)

**Зачем:** превратить «сырую» речь видео в структурированный markdown.

**Системный промпт (краткая версия):**
```
Ты — помощник христианского курса. Тебе дан транскрипт лекции.
Перепиши его в структурированный конспект на русском.
Сохрани все библейские цитаты дословно.
Не добавляй ничего от себя — только перефразируй и структурируй.
Формат: markdown с заголовками ##, списками, цитатами в блоках.
```

**Input:** `transcript_md` из `block_resources` (resource_type='transcript').
**Output:** markdown-текст, сохраняется обратно в `block_resources.transcript_md` (с пометкой `is_summarized=TRUE` — добавим колонку отдельной миграцией).

**Запуск:** скрипт `scripts/transcripts-to-summaries.mjs` (Этап 2, не сейчас).

### 4.2 Генерация вопросов теста (Sonnet, один раз на блок)

**Системный промпт:**
```
Ты составляешь тест по христианскому курсу.
На основе конспекта блока сгенерируй 7-10 вопросов:
- 3-5 single_choice (4 варианта, 1 правильный)
- 1-2 multi_choice (4-5 вариантов, 2-3 правильных)
- 2-3 free_text (открытый вопрос с эталонным смыслом)
Темы: ключевые библейские истины блока.
Не используй вопросы-загадки. Цель — проверить понимание.
```

**Output JSON-schema:**
```json
{
  "questions": [
    {
      "type": "single_choice" | "multi_choice" | "free_text",
      "question_text": "...",
      "options": ["...", "...", "...", "..."]   /* для choice */,
      "correct_indices": [0]                     /* для choice */,
      "expected_answer": "...",                  /* для free_text */
      "rubric": "приемлемо если ученик упомянул X и Y"
    }
  ]
}
```

После генерации — INSERT в `block_quiz_questions` через скрипт `scripts/generate-quiz.mjs` (Этап 3).

### 4.3 Проверка свободного текста ответа (Haiku, runtime)

**Системный промпт:**
```
Ты проверяешь ответ ученика на открытый вопрос.
Дан вопрос, эталонный смысл (expected_answer), рубрика (rubric) и ответ ученика.
Верни JSON: {"verdict": "pass" | "fail", "comment": "<доброжелательный комментарий 1-2 предложения>"}
Pass — если ученик передал ключевую мысль (не дословно).
Fail — если ученик не понял или ответил мимо.
```

**Запуск:** API `/api/m/quiz-submit` зовёт Haiku per-question, агрегирует score.

### 4.4 Транскрибация video_note / voice (Whisper)

**Endpoint:** `https://api.openai.com/v1/audio/transcriptions`
**Модель:** `whisper-1`
**Параметры:** `language=ru`, `response_format=text`
**Input:** mp4/ogg-файл (скачан из Telegram через Bot API).
**Output:** строка-транскрипт.

### 4.5 Сравнение транскрипта с эталоном (Haiku) — два режима

#### 4.5a `verbatim` — заучивание стиха слово-в-слово

**Системный промпт:**
```
Дан эталонный библейский стих и транскрибированный ответ ученика.
Оцени совпадение со стихом слово-в-слово.
Верни JSON: {
  "similarity_score": 0.0..1.0,
  "passed": true|false,
  "comment": "<доброжелательно: что не хватает или хвалю>"
}
passed=true если similarity_score >= similarity_threshold.
Учитывай: ученик мог запнуться, повторить слово, поправиться — это OK.
Главное — все ключевые слова стиха произнесены в правильном порядке.
```

#### 4.5b `meaning` — пересказ сути притчи

**Системный промпт:**
```
Дан текст библейской притчи и пересказ ученика своими словами.
Также дана рубрика — список ключевых элементов, которые должны прозвучать.
Оцени, насколько полно ученик передал суть.
Верни JSON: {
  "similarity_score": 0.0..1.0,
  "passed": true|false,
  "missing_elements": ["..."],
  "comment": "<доброжелательно: что упустил или хвалю>"
}
passed=true если similarity_score >= similarity_threshold (от полноты упомянутых элементов рубрики).
Не требуй дословности. Главное — что ученик правильно понимает суть.
```

**Запуск (оба режима):** Telegram webhook → MiniApp подписывается на медиа → API дёргает Whisper → потом Haiku с нужным промптом по `block_locations_to_recite.check_mode`.

---

## 5. API endpoints

### 5.1 Новые маршруты

| Метод | Путь | Зачем | Auth |
|---|---|---|---|
| POST | `/api/m/block-progress/start` | Создать запись `student_block_progress` при первом открытии блока | Telegram initData |
| POST | `/api/m/block-progress/ack-summary` | Ученик нажал «Прошёл конспект» — переход в `quiz_pending` | Telegram initData |
| GET  | `/api/m/quiz/[blockId]` | Получить вопросы квиза для блока (без `correct_indices`) | Telegram initData |
| POST | `/api/m/quiz/submit` | Принять ответы, прогнать через Haiku, записать `student_quiz_attempts` | Telegram initData |
| GET  | `/api/m/locations/[blockId]` | Получить список местописаний блока (без `exact_text` если ещё не прошёл) | Telegram initData |
| POST | `/api/telegram/webhook` (расширение существующего) | Обработка `video_note` / `voice` от ученика, выбор эталона по контексту чата, Whisper + Haiku | Telegram secret token |
| GET  | `/api/m/exam/[type]` | `type=mid|final` — отдать вопросы для экзамена | Telegram initData |
| POST | `/api/m/exam/submit` | Принять ответы экзамена | Telegram initData |

### 5.2 Расширение существующих

- `/api/m/video-progress` — без изменений, уже есть.
- `/api/m/dashboard` (если есть) — добавить чтение `student_block_progress` для отрисовки статусов карточек.

### 5.3 Скрипты (server-side, запуск Михаилом)

- `scripts/transcripts-to-summaries.mjs` — Sonnet переписывает транскрипты (Этап 2).
- `scripts/generate-quiz.mjs <block_id>` — Sonnet генерит вопросы → INSERT (Этап 3).
- `scripts/seed-locations.mjs` — INSERT эталонов местописаний из конфигурационного JSON (Этап 4).

---

## 6. UI в MiniApp `/m/*`

### 6.1 Новые экраны

| Путь | Контент |
|---|---|
| `/m/lesson/[blockId]` | Уже есть. Расширяется: видео → конспект (новый раздел) → кнопка «Перейти к тесту» |
| `/m/quiz/[blockId]` | Список вопросов, формы ввода, кнопка «Отправить». После submit — экран результата с per-question feedback от Haiku |
| `/m/locations/[blockId]` | Список эталонов с инструкцией: «Открой @cross_bot, отправь видео-кружок или голосовое с этим стихом» + статус каждого (pending/passed/failed_attempts) |
| `/m/exam/[type]` | Аналогично quiz, но обёртка «Промежуточный экзамен» / «Финальный экзамен» |
| `/m/completed` | Финальный экран курса — поздравление + ссылка на условный «следующий шаг» (личная встреча с куратором, потом) |

### 6.2 Telegram бот

- Новые команды/кнопки в боте: «Отправить местописание для Блока N» → бот переходит в режим «жду video_note или voice»
- Webhook сохраняет файл, привязывает к ученику, дёргает Whisper → Haiku, отвечает результатом в чат и обновляет UI MiniApp (через Realtime или polling).

---

## 7. Реализационная карта (Этапы 1-5)

### Этап 1 — текущий — Спека + фундамент

- [x] `04-ai-first-flow.md` (этот документ)
- [ ] Миграция `20260508_v3_quiz_questions.sql`
- [ ] Миграция `20260508_v3_locations_to_recite.sql`
- [ ] Миграция `20260508_v3_student_block_progress.sql`
- [ ] Миграция `20260508_v3_exam_progress.sql`
- [ ] Миграция `20260508_v3_quiz_and_location_attempts.sql`
- [ ] Миграция `20260508_v3_ai_call_log.sql`
- [ ] `apps/web/src/lib/ai/anthropic.ts` (Sonnet + Haiku клиенты)
- [ ] `apps/web/src/lib/ai/whisper.ts` (OpenAI клиент)

### Этап 2 — Конспекты

- Скрипт `scripts/transcripts-to-summaries.mjs`
- UI раздела «Конспект» в `/m/lesson/[blockId]`

### Этап 3 — Квизы

- Скрипт `scripts/generate-quiz.mjs`
- API `/api/m/quiz/*`
- UI `/m/quiz/[blockId]`

### Этап 4 — Местописания

- Михаил seed'ит эталоны для Блоков 1-10 (через `scripts/seed-locations.mjs` или вручную в миграции)
- Telegram webhook расширение
- UI `/m/locations/[blockId]`

### Этап 5 — Mid + Final + Поздравление

- API `/api/m/exam/*`
- UI `/m/exam/[type]`, `/m/completed`

### Этап 6 — Финальный экзамен с куратором (потом)

Реализация позже.

---

## 8. Открытые вопросы для Михаила (закрыты — см. §10)

Архив исходных вопросов и принятые решения см. §10 ниже. Открытые вопросы оставшиеся:

- **OQ-A:** Длинные местописания (Бытие 3:1-6 в Блоке 3 — 110+ слов) — `verbatim` или `meaning`? (По умолчанию буду писать `meaning` как для притчи про Лазаря, если не скажешь иначе.)
- ~~OQ-B: Дублирование Вводного урока~~ — закрыто 2026-05-09: **гибрид (в)**, `is_required=FALSE` в `block_resources` для Блока 1.
- **OQ-C:** Нужно ли в `block_locations_to_recite.is_required=FALSE` стих ВСЁ РАВНО показывать в UI блока (как «расширенный разбор»), или просто храним в БД для будущей генерации конспекта?

---

## 9. Что считаем «готово» для Этапа 1

- ✅ Этот документ согласован Михаилом (можно с правками)
- ✅ Все миграции из §7 применены к продакшн БД через MCP `apply_migration`
- ✅ `anthropic.ts` и `whisper.ts` написаны, протестированы локальным вызовом «Hello»
- ✅ Никакой UI/скриптовой логики ещё нет — это фундамент

---

## 10. Принятые решения и константы (2026-05-09)

После согласования с Михаилом по §8:

| # | Параметр | Значение | Где используется |
|---|---|---|---|
| 1 | `MAX_QUIZ_ATTEMPTS` | **3** | Блочный квиз, mid-exam, final-exam, местописания |
| 2 | `QUIZ_LOCK_DURATION` | **24 часа** | После 3-й неудачи — `quiz_locked_until` / `locations_locked_until` / `exam_locked_until` |
| 3 | `BLOCK_QUIZ_PASS_PCT` | **75%** | Блочный квиз |
| 4 | `MID_EXAM_PASS_PCT` | **80%** | Промежуточный экзамен после Блока 5 |
| 5 | `FINAL_EXAM_PASS_PCT` | **85%** | Финальный экзамен после Блока 10 (минимум) |
| 6 | Хранение video_note/voice | **Да, в Supabase Storage** | Bucket `student-recitations`, private |
| 7 | `DEFAULT_SIMILARITY_THRESHOLD` | **0.85** | Дефолт в `block_locations_to_recite.similarity_threshold` |
| 8 | Эталоны местописаний | **Михаил подгружает блок-за-блоком** (см. `04a-locations-seed.md`) | seed-миграция Этапа 4 |
| 9 | Соотношение типов вопросов в квизе | **3-5 single + 1-2 multi + 2-3 free_text** | Промпт генерации (Sonnet) |
| 10 | Вступление перед Блоком 1 | **Отдельная сущность `course_intro_video`** (см. §3.8) | Новая таблица + `student_intro_progress` |
| 11 | Бот для местописаний | **Без state machine в боте** — MiniApp подписывается на новые медиа и сама определяет контекст | Webhook просто складывает медиа, MiniApp матчит |
| 12 | Режимы проверки местописаний | **`verbatim` / `meaning`** (см. §3.2 и §4.5) | Колонка `check_mode` в `block_locations_to_recite` |
| 13 | `is_required` для местописаний | Флаг — **info-only** стихи AI не проверяет (Бытие 1:28 в Блоке 2) | Колонка `is_required` |

**Where to find:** ходкоженно в коде через константы в `apps/web/src/lib/ai/constants.ts` (создаётся в Этапе 1, шаг 4). Изменения только через PR + миграцию (если меняется структура).

---

*Версия 1.1 | 2026-05-09 | §0-§7 одобрены. §8 закрыт через §10. Ждём только: длинные местописания (verbatim/meaning?), дубль Вводного урока, материалы Блоков 4-10.*
