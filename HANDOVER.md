# HANDOVER — КРЕСТ
> Дата: 2026-05-07 | Сессия: ✅ Этап Б шаг A закрыт коммитом `735ca47` (no-skip overlay для Kinescope). 🆕 **Получено новое ТЗ — переориентация на Telegram-first + AI-замена куратора для блоков 1-10.** Следующая сессия начинает Этап 1 — спека и фундамент нового потока.

---

## 🎯 Главное (читать первым)

1. **Ветка:** `feat/nextjs-miniapp-poc`, последний коммит `735ca47`. **В main не сливать.**
2. **Направление поменялось 2026-05-07.** Алекс предложил Михаилу разгрузить кураторов от рутины. AI заменяет куратора на блоках 1-10. Куратор остаётся ТОЛЬКО для финального экзамена курса (личная встреча, реализация позже).
3. **Telegram-first.** Веб-версия второстепенна. Гибрид: MiniApp для конспектов и тестов, бот для видео-кружков и голосовых.
4. **БД продакшн (`aejhlmoydnhgedgfndql`):** v3.0 фундамент + роли + `block_resources` (7 строк для Блока 1) + `video_watch_progress` (no-skip). 14 файлов в Storage `block-resources`.
5. **Maintenance mode активен** для `/admin/*` и лендинга, `/m/*` пропускается.

---

## 🆕 НОВОЕ ТЗ (2026-05-07) — обязательно к чтению

### Источник

Михаил получил голосовые уточнения от Алекса (преподавателя курса) + сам уточнил детали. См. `memory/project_new_flow_ai_first.md` — там полная сводка с архитектурными решениями.

### Поток ученика по новому ТЗ

```
🎬 Вступление (existing «Вводный урок», no-skip)
       ↓
📦 Блок 1
   ├ no-skip видео        → AI auto-approve при ≥95%       (✅ сделано — шаг A)
   ├ конспект (markdown)  → AI генерирует из транскрипта   (Этап 2)
   ├ тест AI (галочки + текст по пунктам + аудио)          (Этап 3)
   └ местописания (video_note/voice через бот → AI)         (Этап 4)
       ↓ AI auto-approve всех 4 пунктов → Блок 2
📦 Блок 2-4 → ... ↓
📦 Блок 5 → ... + ⭐ ПРОМЕЖУТОЧНЫЙ AI-ТЕСТ
📦 Блок 6-10 → ... ↓
       ↓
⭐⭐⭐ ФИНАЛЬНЫЙ AI-ТЕСТ по всему курсу
       ↓
🎉 «Поздравляем, вы прошли курс КРЕСТ»
       ↓
🎓 ЛИЧНЫЙ ЭКЗАМЕН с куратором  ← пока НЕ делаем (Михаил скажет «делать когда»)
```

### Ключевая мысль

AI-этап = **подготовка** ученика. Куратор разгружен от рутины, появляется только для финальной личной встречи. Это масштабирует платформу.

### Утверждённые архитектурные решения

| # | Решение |
|---|---|
| 1 | **UI гибрид** — основной flow в MiniApp `/m/*`, кружки/голосовые через бот |
| 2 | **AI стек** — OpenAI Whisper (audio→text) + Anthropic Claude (Sonnet для генерации, Haiku для проверок) |
| 3 | **Эталоны местописаний** — захардкожены в миграции `block_locations_to_recite`. Михаил пришлёт точные стихи |
| 4 | **Тест-вопросы** — AI Claude Sonnet генерирует один раз → сохраняются в `block_quiz_questions` → можно править вручную |
| 5 | **Куратор полностью убран** из UI и потока для блоков 1-10. БД-связи (`profiles.curator_id`, `is_visible_to`, RLS) остаются dormant. Возвращается ТОЛЬКО для финального экзамена курса |
| 6 | **Вступление** — существующий `additional_video` Блока 1 «Вводный урок» (Kinescope `ntfUqbL89b9mrGzrgKrLbW`). Отдельного видео нет |

---

## ✅ Что было сделано в сессии 2026-05-03

### Этап Б шаг A — no-skip overlay для Kinescope (commit `735ca47`)

Файлы:
- `supabase/migrations/20260503130000_v3_video_watch_progress.sql` — таблица + RLS + индексы
- `apps/web/src/lib/telegram/init-data.ts` — HMAC валидация (helper)
- `apps/web/src/app/api/m/video-progress/route.ts` — POST с initData → UPSERT прогресса
- `apps/web/src/components/lesson/KinescopePlayerNoSkip.tsx` — Client Component с CDN-loader Kinescope SDK, polling 500мс, seekTo назад при > maxWatched + 2
- `apps/web/src/components/lesson/LessonVideos.tsx` — обёртка fetch progress at mount
- `apps/web/src/app/m/lesson/[blockId]/page.tsx` — заменён старый VideoCard на LessonVideos
- `apps/web/src/app/m/lesson/[blockId]/lesson.css` — стили `.kp*`
- `packages/supabase/src/types.ts` — добавлен тип video_watch_progress

**Логика:** при `completed_at IS NULL` no-skip активен, при ≥95% → `completed_at` фиксируется и no-skip отключается навсегда. Throttle БД 5 сек + force при visibilitychange/pagehide/unmount.

**Тестирование:** Михаил проверил локально через `localhost:3000/m/lesson/1` — перемотка возвращает курсор назад. ✅

---

## 🛤 План работы по новому ТЗ — Этапы 1-6

### Этап 1 (1 сессия) — Спека + фундамент

1. Документ `docs/spec-first/04-ai-first-flow.md` — детальная спека нового потока
2. Миграция: `block_quiz_questions`, `block_locations_to_recite`, `student_block_progress`
3. Env keys (Михаил добавит сам в `apps/web/.env.local`):
   - `ANTHROPIC_API_KEY` (для Claude)
   - `OPENAI_API_KEY` (для Whisper)
4. Helpers `lib/ai/anthropic.ts`, `lib/ai/whisper.ts` — клиенты с retry/error handling

### Этап 2 (1 сессия) — Конспект из транскриптов

1. Скрипт `scripts/transcripts-to-summaries.mjs` — Claude Sonnet переписывает сырой транскрипт в markdown-конспект, сохраняет в `block_resources.transcript_md`
2. UI улучшение в MiniApp — листабельный конспект (lessons section)
3. Заодно — фиксим RTF-парсер: убираем строки `Attachment.png ¬` из гайда

### Этап 3 (1-2 сессии) — Тест/квиз после блока

1. Скрипт `scripts/generate-quiz.mjs` — Claude Sonnet генерирует вопросы по конспекту Блока 1 → INSERT в `block_quiz_questions`
2. UI квиза в MiniApp `/m/quiz/[blockId]` — галочки + текстовое поле + кнопка отправки голосового
3. API `/api/m/quiz-submit` — Claude Haiku проверяет ответы, возвращает «pass/fail» + комментарий
4. Запись в `student_block_progress`

### Этап 4 (1-2 сессии) — Местописания через бот

1. Эталоны для Блока 1 — миграция + Михаил seed'ит точные стихи в `block_locations_to_recite`
2. Telegram бот хендлер: команда «отправить местописание» → ученик присылает video_note или voice → webhook
3. Webhook: скачать файл через Telegram Bot API → OpenAI Whisper → Claude Haiku сравнение со словом-в-слово эталоном → результат
4. UI в MiniApp — статус «отправлено / проверено / принято / отклонено»
5. Запись в `student_block_progress`

### Этап 5 (1 сессия) — Промежуточный + финальный AI-тесты + поздравление

1. После Блока 5 — промежуточный AI-тест (то же что обычный квиз, но шире — по блокам 1-5)
2. После Блока 10 — финальный AI-тест по всему курсу
3. Финальный экран `/m/completed` — «Поздравляем, вы прошли курс КРЕСТ»

### Этап 6 (потом, не в текущей фазе) — Финальный экзамен с куратором

Личная встреча. Михаил скажет «делать когда».

### Параллельные/независимые задачи (можно вставлять между этапами)

| Задача | Когда |
|---|---|
| Залить материалы Блоков 2-10 (если у тебя готовы) | Когда материалы будут — расширим существующий скрипт `upload-resources.mjs` |
| Hero лендинга через Midjourney | Когда будет готовая картинка |
| Push в GitHub + Vercel preview | Когда захочешь проверить через @Cross_Capsule_Test_bot |
| Закрыть техдолги (legacy `admin/*`, `student/*` под v3.0; `middleware.ts → proxy.ts`; hydration warning; `agent-architect.md`) | Любое время |

---

## 📂 Состояние БД и Storage на 2026-05-07

**Таблицы public schema (15):**
- `profiles` (10 строк)
- `courses` (2: krest active, 10-pisem coming_soon)
- `blocks` (10)
- `block_resources` (7 строк для Блока 1)
- `video_watch_progress` (новая, пуста — заполняется по мере просмотра)
- `lessons`, `bible_verses`, `student_progress`, `journal_entries`, `uploads`, `weekly_submissions` — пусты
- `countries` (9), `cities` (28, 1 active=Бали)
- `course_progress` (10 строк, все unlocked для КРЕСТ)
- `role_change_log` (пусто), `notifications_log` (как было)

**Storage `block-resources`** (private bucket): 5 файлов в `01-maly-krest/`, ~21 MB суммарно.

**Функции:**
- `is_admin()`, `is_visible_to()`, `update_updated_at_column()`, `get_leader_chat_id()`

---

## ⚙️ Технические условия следующей сессии

1. **MCP Supabase** работает (`.mcp.json.example` в репо). В свежем клоне: `cp .mcp.json.example .mcp.json` + подставить токен.
2. **Новые env-переменные** (Михаил должен добавить в `apps/web/.env.local` перед Этапом 1):
   - `ANTHROPIC_API_KEY=sk-ant-...`
   - `OPENAI_API_KEY=sk-...`
   - **Не присылать ключи в чат** — формат `feedback_secret_handling.md`. Просто сказать «ключи добавил».
3. **Папка с материалами** с пробелом в конце имени: `/Users/rogue/Desktop/Капсула крест материалы /`
4. **Permissions Bash:** `npm install`, `npm run`, `node *` в `deny`. Скрипты Михаил запускает сам.
5. **Безопасность:** никогда не запрашивать у Михаила полные секреты в чате. Только префикс 4-6 символов.

---

## 📂 Ключевые файлы и пути

**Миграции v3 (применены):**
- `supabase/migrations/20260501120000_v3_foundation.sql`
- `supabase/migrations/20260501130000_v3_roles_hierarchy.sql`
- `supabase/migrations/20260502120000_v3_block_resources.sql`
- `supabase/migrations/20260502130000_v3_storage_block_resources.sql`
- `supabase/migrations/20260503130000_v3_video_watch_progress.sql`

**Будут добавлены в Этапе 1:**
- `supabase/migrations/{timestamp}_v3_quiz_questions.sql`
- `supabase/migrations/{timestamp}_v3_locations_to_recite.sql`
- `supabase/migrations/{timestamp}_v3_student_block_progress.sql`

**Спеки и правила (актуально):**
- `SPEC.md` v3.0 — общая техспека (часть про куратор-первый поток сейчас на паузе)
- `UI_UX_BRIEF.md` v3.0 — дизайн-система
- `CLAUDE.md` v3.0 — правила разработки
- `.claude/rules/church-platform.md`
- `docs/spec-first/03-block1-maly-krest.md` — план 16 этапов (часть актуальна, часть переосмыслить под новое ТЗ)
- 🆕 `docs/spec-first/04-ai-first-flow.md` — будет создан в Этапе 1

**Активные аккаунты:**
| Роль | Identifier |
|------|------------|
| super_admin (protected) | sleezard@gmail.com / chat_id 255214568 / DB password `237` |
| Telegram bot (прод) | @cross_bot |
| Telegram bot (тест PoC) | @Cross_Capsule_Test_bot |
| Production URL | https://krest-platform-web.vercel.app/ (maintenance gate) |
| Preview PoC | https://krest-platform-j7j95rmw6-mikhail7000s-projects.vercel.app/m/dashboard |

---

## 🚀 Что сделать в начале новой сессии

### Команда для Михаила

Открой Claude Code в проекте и напиши:

> Прочитай HANDOVER.md и memory/MEMORY.md (особенно project_new_flow_ai_first.md). Скажи мне коротко в каком мы состоянии, что нового в ТЗ, и предложи приступить к Этапу 1 — спека + миграции для AI-first flow. Ничего пока не запускай.

### Что новый Claude должен сделать в начале

1. Прочитать HANDOVER (этот файл)
2. Прочитать `memory/project_new_flow_ai_first.md` — там утверждённые архитектурные решения
3. Прочитать остальной индекс памяти выборочно
4. Не лезть в код / БД / MCP
5. Кратко резюмировать в ответ:
   - Где мы (закрыт шаг A — no-skip)
   - Что нового (новое ТЗ от 2026-05-07)
   - Что предлагает (Этап 1)

### Чего сейчас НЕ делать

- Не трогать legacy `student/*` и `admin/*` (это техдолг, не блокер)
- Не делать UI для куратора (он на паузе)
- Не присылать секреты в чат

---

## 📌 Договорённость по работе со скриншотами (без изменений)

1. Скриншоты сохранять на диск в `notes/screenshots/`, не вставлять из буфера
2. Перед тяжёлой сессией со скринами — `/handoff` + новая сессия
3. `/compact` когда контекст забивается
4. Текст вместо скриншота, где можно (логи, ошибки, код)
5. 5-7 скринов в сессии — норма, 20+ — гарантированная проблема

---

## 🤖 Команда субагентов (актуальна, но agent-architect.md устарел — техдолг)

| Агент | Модель | Зона |
|-------|--------|------|
| `database-architect` | Opus | Миграции через MCP `apply_migration` |
| `backend-engineer` | Sonnet | API routes, скрипты, AI-интеграции (Anthropic, OpenAI Whisper), Telegram Bot |
| `frontend-developer` | Sonnet | React/TS — Next.js MiniApp `/m/*` + админка + лендинг |
| `content-manager` | Sonnet | Парсинг материалов, AI-генерация конспектов и квизов, заливка эталонов местописаний |
| `qa-reviewer` | Sonnet | Code review + RLS audit |
| `agent-architect` | Opus | Координация при больших миграциях. ⚠ Файл агента содержит legacy v2.0 описание — обновить под v3.0 одним редактом. |

---

*Версия 11.0 | 2026-05-07 | Этап Б шаг A закрыт коммитом `735ca47` (no-skip). Получено новое ТЗ: Telegram-first + AI заменяет куратора для блоков 1-10. Следующая сессия — Этап 1 (спека + фундамент AI-first flow).*
