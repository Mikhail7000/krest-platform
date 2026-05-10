# HANDOVER — КРЕСТ
> Дата: 2026-05-10 | Сессия: ✅ **AI-first MVP полностью собран**. Этапы 1-5 закрыты, экзамены сданы, экран «Мастер Креста» работает, pre-deploy фиксы применены. Следующая сессия — **деплой на Vercel + интеграция с @cross_bot**.

---

## 🎯 Главное (читать первым)

1. **Ветка:** `feat/nextjs-miniapp-poc`. Последний коммит `83ef29e` (pre-deploy фиксы).
2. **Демо ученического flow собрано целиком:** ученик проходит 10 блоков (видео + конспект + квиз + 2-этапные местописания + аудио-пересказ + видеокружки + фото креста), сдаёт mid после Блока 5, final после Блока 10, видит экран «МАСТЕР КРЕСТА» с цитатой 1 Иоанна 2:14, курс «10 писем» автоматически unlock.
3. **Михаил лично прошёл флоу end-to-end:** mid 80% / final 100%. `course_progress` корректно обновился: КРЕСТ→`completed`, 10-pisem→`unlocked`.
4. **БД (`aejhlmoydnhgedgfndql`):** 32 таблицы public, 7 функций, 2 storage bucket, RLS везде. **22 миграции** v3 применены.
5. **`tsc --noEmit` чистый. Все агентные правки сошлись без рассогласований.**
6. **Maintenance mode:** активен. Whitelist в БД (`profiles.is_whitelisted`) — управляемый.

---

## ✅ Что работает

- **`/m/dashboard`** — список 10 блоков с прогрессом + карточки экзаменов после Блока 5/10 + ссылка на сертификат если курс завершён.
- **`/m/lesson/[blockId]`** — Kinescope видео с no-skip overlay, открытый markdown-конспект под каждым видео (react-markdown + remark-gfm), плашка «День X / 7» или «✓ Тестовый режим», свёрнутый гайд «Эпоха пятницы» с кнопкой «Скачать», карточки навигации к практике блока.
- **`/m/quiz/[blockId]`** — 8 вопросов на блок (single + multi + free_text), Haiku оценивает свободные «по сути» (мягкий промпт), золотая плашка «КОММЕНТАРИЙ ПРЕПОДАВАТЕЛЯ» под каждым вопросом, 75% pass.
- **`/m/locations/[blockId]`** — 11 местописаний Блока 1 + по N в каждом блоке, двухэтапная сдача (аудио → кружок), пасхалки A/B ротируются по `order_index % 4`, MediaRecorder + file fallback, video preview, Deepgram + Haiku verbatim/meaning сравнение.
- **`/m/recitation/[blockId]`** — пересказ блока: аудио (32 kbps, до 10 мин = ~2.4 MB) + видеокружки.
- **`/m/cross-photo/[blockId]`** — календарь 7 дней с миниатюрами (signed URLs), мотто «Верность и постоянство — ключ к успеху». **Цитаты на каждый день УБРАНЫ по решению Михаила** (перегружали).
- **`/m/exam/mid`** — 15 вопросов, pass 80%.
- **`/m/exam/final`** — 25 вопросов, pass 85%, 5-сек автопереход на /m/completed.
- **`/m/completed`** — финальный экран «МАСТЕР КРЕСТА» с цитатой 1 Иоанна 2:14, балл, карточка «10 писем».
- **AI-инфра:** `lib/ai/anthropic.ts` (Sonnet/Haiku), `lib/ai/whisper.ts`, `lib/ai/deepgram.ts` (Nova-2). Все 3 логируют в `ai_call_log`.
- **Whitelist:** `profiles.is_whitelisted=TRUE` или `role IN super_admin/admin/curator` пускает в MiniApp. Остальные видят «Платформа ещё не открыта». Управляется одним SQL UPDATE.
- **Dev-bypass:** `DEV_BYPASS_USER_ID` в `.env.local` пускает Михаила в браузере без Telegram.

## 🔄 Что в процессе

Ничего открытого. Сессия закрыта на чистом состоянии перед деплоем.

## ❌ Что сломано / технические долги

- **`apps/web/package.json` script `lint`** всё ещё на `next lint` (Next 16 удалил). Не блокер для прода — заменить на `tsc --noEmit && eslint . --ext .ts,.tsx`.
- **Унаследованные WARN advisors** (~16 шт): `function_search_path_mutable` + `anon/authenticated_security_definer_function_executable` для функций `is_admin`, `is_visible_to`, `get_leader_chat_id`, `handle_new_user`, `update_*`. Не критично, чистится одной миграцией.
- **`agent-architect.md`** в `.claude/agents/` всё ещё содержит legacy v2.0 описание. Если будем запускать координирующего агента — обновить.

---

## 🆕 Главные решения этой сессии

| Решение | Почему | Где смотреть |
|---|---|---|
| Этап 3: квизы по блокам через Sonnet (генерация) + Haiku (проверка свободных) | AI auto-approve без куратора, спека §10 | `scripts/generate-quizzes.mjs`, `apps/web/src/app/api/m/quiz/*` |
| Этап 4: местописания в 2 этапа (аудио → видеокружок) | Алгоритм Михаила: аудио = тренировка с подсматриванием, кружок = «по-боевому» | memory `project_block_duration_and_stage4.md` |
| 7-day gate с обходом для тестов | Жёсткое правило «1 блок = 1 неделя», но super_admin/тестовые ученики (`can_skip_block_lock=TRUE`) — без ожидания | миграция `..._is_block_unlocked.sql`, функция в БД |
| Deepgram Nova-2 вместо Whisper | Алекс рекомендует, лучше для русского, $0.0043/мин, 200$ free credit | `lib/ai/deepgram.ts`, memory `project_transcription_deepgram.md` |
| Этап 5: mid (80%) + final (85%) + Мастер Креста | Завершение демо целиком, unlock «10 писем» | `apps/web/src/app/m/exam/[type]`, `/m/completed` |
| BD-driven whitelist вместо env-переменной | Гибкость: добавить ученика — один SQL, без redeploy | `apps/web/src/lib/telegram/resolve-user.ts` |
| OpenRouter — отложен до post-демо | Михаил: «сначала рабочая демо, потом инфраструктура» | memory `project_ai_providers_plan.md` |
| Self-hosted Supabase на Beget (152-ФЗ) — план | Урок 21 Алекса. Когда массовые ученики из РФ | memory `project_ai_providers_plan.md` |
| Цитаты на дни календаря фото — убраны | «Перегружают, лишняя информация» (Михаил) | `m/cross-photo/[blockId]/CrossPhotoClient.tsx` |
| Заголовок «ЭТАП 4» в UI заменён на «Практика блока» | «Этап 4» — внутренний термин разработки, ученику бессмысленно | `m/lesson/[blockId]/Stage4Nav.tsx` |
| Pre-deploy фиксы по Уроку 18 Алекса | timingSafeEqual + auth_date ≤ 8h + CSP + 32 kbps audio | коммит `83ef29e` |

---

## 📂 Все коммиты этой сессии (12 шт.)

```
83ef29e chore(pre-deploy): timingSafeEqual + auth_date + CSP + 32kbps
70f6a67 feat(whitelist): БД-управляемый список разрешённых
9cd683a feat(stage5): экзамены mid+final + Мастер Креста + dashboard
a441be9 fix(locations): video preview для кружков
976b613 fix(stage4): webm bucket + дата timezone + recitation contract + цитаты убраны
887dde9 fix(stage4): locations unlock + signed photo URL + hydration
ce25a98 fix(lesson): свернуть гайд «Эпоха пятницы»
70ae362 fix(lesson): убрать «Этап 4» из UI
46fb10f feat(stage4): местописания + пересказ + фото + 7-day gate
216e9f1 feat(quiz): этап 3 — квизы 10 блоков
83e8167 feat(lesson): UI «Конспект» под видео
1684c15 feat(ai-first): этапы 1-2 — спека, 11 миграций, AI-хелперы
```

---

## 🛤 TODO следующей сессии (в порядке)

### Деплой на Vercel

1. **Проверить env-переменные на Vercel** (Project Settings → Environment Variables):
   - `TELEGRAM_BOT_TOKEN` ✅ (Михаил настроил ранее)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ✅
   - `ANTHROPIC_API_KEY` ✅
   - `OPENAI_API_KEY` ✅ (для Whisper-fallback)
   - `DEEPGRAM_API_KEY` ⚠ нужно перенести из локального .env.local (начинается на `15081f...`)
   - `MAINTENANCE_MODE=true` (whitelist в БД работает поверх)
   - `MAINTENANCE_BYPASS_TOKEN` ✅ (аварийный)
   - **УДАЛИТЬ:** `MAINTENANCE_ALLOWED_CHAT_IDS` (больше не используется)
   - **УДАЛИТЬ:** `DEV_BYPASS_USER_ID` (это только для локальной разработки!)
2. **Push на GitHub:** `git push origin feat/nextjs-miniapp-poc`. Vercel автоматически создаст preview deployment. Когда уверены — merge в `main` для production.
3. **Smoke-тест preview URL** в обычном браузере: должен показать «Откройте через Telegram».

### Интеграция с @cross_bot

4. **BotFather → @cross_bot:**
   - **Menu Button URL** — поставить URL Vercel deployment (например `https://krest-platform-web.vercel.app/m/dashboard`)
   - **Domain** — в Bot Settings → Configure Mini App → ввести домен (без https://, без trailing /)
5. **Телефон-тест в Telegram:** открыть @cross_bot, нажать Menu Button → должен открыться MiniApp на телефоне. Камера/микро/фото — всё работает (HTTPS на Vercel автоматически).

### Расширение whitelist для тестовых учеников

6. Михаил приглашает Александра Алферева (книжка) и 2-3 тестовых учеников:
   - Они запускают `@cross_bot` командой `/start` (попадают в `profiles`)
   - Узнают свой chat_id через `@userinfobot`
   - Михаил выполняет: `UPDATE profiles SET is_whitelisted=TRUE WHERE telegram_chat_id=N;` (через MCP execute_sql)
   - Они открывают MiniApp и проходят курс

### Когда демо одобрено — миграция инфраструктуры

7. **OpenRouter** для всех LLM-вызовов (один ключ, гибкость моделей). См. memory `project_ai_providers_plan.md`.
8. **Self-hosted Supabase на Beget VPS** для соблюдения 152-ФЗ (когда массовые ученики из РФ). См. memory `lessons15_18_20_21_for_krest.md`, Урок 21.
9. **Custom domain** через Beget (`.ru`, 199 ₽/год) или Cloudflare Registrar.

### Параллельно (можно вставлять)

| Задача | Когда |
|---|---|
| HapticFeedback на submit квиза/экзамена | После деплоя, как UX-улучшение |
| BackButton wrapper на /m/lesson, /m/quiz, /m/exam, /m/locations и т.д. | После деплоя |
| Починить `lint` script в `apps/web/package.json` | Любое время |
| Почистить унаследованные advisors WARN | Перед запуском с массовыми учениками |
| Сертификат PDF «Мастер Креста» с tg.downloadFile | После запуска |
| Тренажёр местописаний (Quizlet-стиль) | Запросит Михаил позже |
| Запрос куратору на ускорение блока | Когда будет админка кураторов |

---

## ⚙️ Технические условия следующей сессии

1. **MCP Supabase** работает. project_ref `aejhlmoydnhgedgfndql`.
2. **Env-переменные** в `apps/web/.env.local`:
   - ✅ `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPGRAM_API_KEY` (15081f...)
   - ✅ `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - ✅ `DEV_BYPASS_USER_ID=281ddca3-c413-43e3-bbb1-02bd60d6d2f7` (Михаил, super_admin) — **только для локальной разработки**
   - ✅ `MAINTENANCE_MODE=true`, `MAINTENANCE_BYPASS_TOKEN=...`
   - `TELEGRAM_BOT_TOKEN=...`
3. **Permissions Bash:** `npm install`, `npm run`, `node *` в deny у Claude. Михаил запускает скрипты сам.
4. **Безопасность:** не запрашивать у Михаила полные секреты (только префикс с маркой «остальное замазал»).

---

## 📂 Ключевые файлы и пути

**Спеки и rules:**
- `CLAUDE.md` v3.0
- `.claude/rules/church-platform.md` v3.0
- `docs/spec-first/04-ai-first-flow.md` v1.1 — главная спека AI-first потока
- `docs/spec-first/04a-locations-seed.md` v1.0 — 55 эталонных местописаний
- Memory:
  - `lessons15_18_20_21_for_krest.md` — что взять из уроков Алекса (CSP, signed URLs, 152-ФЗ, VPS)
  - `project_ai_providers_plan.md` — миграция на OpenRouter+Deepgram
  - `project_block_duration_and_stage4.md` — 7-day gate + расширенная модель сдачи
  - `project_stage4_easter_eggs.md` — финальные тексты пасхалок
  - `project_priority_demo_first.md` — приоритет демо

**AI-инфраструктура:**
- `apps/web/src/lib/ai/anthropic.ts` (`callAnthropic`)
- `apps/web/src/lib/ai/whisper.ts` (`callWhisper`)
- `apps/web/src/lib/ai/deepgram.ts` (`callDeepgram`)
- `apps/web/src/lib/ai/constants.ts` — все pass-критерии и лимиты
- `apps/web/src/lib/quiz/check.ts` — переиспользуется в exam (single/multi/free_text)
- `apps/web/src/lib/locations/check.ts` — verbatim/meaning сравнение
- `apps/web/src/lib/recitation/check.ts` — мягкая оценка пересказа
- `apps/web/src/lib/telegram/init-data.ts` — HMAC + auth_date (timingSafeEqual)
- `apps/web/src/lib/telegram/resolve-user.ts` — DEV_BYPASS + whitelist
- `apps/web/src/lib/supabase-service.ts` — service-role клиент

**API endpoints (всё через resolveUserId):**
- `/api/m/quiz/[blockId]` + `/submit`
- `/api/m/locations/[blockId]` + `/upload`
- `/api/m/recitation/[blockId]` + `/upload`
- `/api/m/cross-photo/[blockId]` + `/upload`
- `/api/m/exam/[type]` + `/submit`
- `/api/m/completed`
- `/api/miniapp/maintenance-check` (whitelist gate для TelegramProvider)

**Скрипты:**
- `scripts/transcripts-to-summaries.mjs` (10 блоков → конспекты, $0.37)
- `scripts/upload-transcripts-blocks-2-10.mjs` (заливка txt + Kinescope ID)
- `scripts/generate-quizzes.mjs` (10 × 8 вопросов = 80, $0.35)
- `scripts/generate-exams.mjs` (mid 15 + final 25, $0.24)

**Активные аккаунты:**
| Роль | Идентификатор |
|------|---------------|
| super_admin (protected, can_skip_block_lock=TRUE, is_whitelisted=TRUE) | sleezard@gmail.com / chat_id 255214568 / UUID 281ddca3-c413-43e3-bbb1-02bd60d6d2f7 |
| Telegram bot (прод) | @cross_bot |
| Telegram bot (тест PoC) | @Cross_Capsule_Test_bot |
| Production URL | `https://krest-platform-web.vercel.app/` (maintenance gate) |
| Supabase project ref | `aejhlmoydnhgedgfndql` |

---

## 🚀 Что сделать в начале новой сессии

### Команда для Михаила

> Прочитай HANDOVER.md и memory/MEMORY.md (особенно `lessons15_18_20_21_for_krest.md` и `project_ai_providers_plan.md`). Демо собрано целиком. Сегодня деплоим на Vercel + интегрируем с @cross_bot, чтобы можно было тестировать на телефоне.

### Что новый Claude должен сделать

1. Прочитать HANDOVER.md (этот файл)
2. Просканировать индекс `memory/MEMORY.md`
3. Кратко отчитаться: где мы, что в TODO
4. Спросить готовность Михаила к деплою (env-переменные на Vercel перенесены?)
5. Двигаться по списку TODO раздела «Деплой на Vercel» → «Интеграция с @cross_bot»

### Чего НЕ делать

- НЕ запускать локально новые скрипты без явной просьбы — все вопросы экзаменов уже в БД
- НЕ применять миграцию OpenRouter — отложено до явного «демо одобрено»
- НЕ удалять/перетирать legacy v2.0 таблицы (`bible_verses`, `journal_entries`, `weekly_submissions` — они пусты, не мешают)
- НЕ присылать секреты в чат
- НЕ запускать subagents без явной просьбы Михаила (последний раз 3 параллельных в Этапе 5 — было правильно, но это исключение для крупных параллельных задач)

---

## 📊 Состояние БД на 2026-05-10 (после demo-прохода Михаилом)

**Таблицы public schema (32):** базовые v3 + AI-first + Stage 4 + Stage 5 + leader_materials + legacy v2.0 (пусты).

**Прогресс Михаила (super_admin):**
- `student_quiz_attempts` — есть записи блочных квизов + mid (80%) + final (100%)
- `student_exam_progress` — mid passed_at + final passed_at
- `course_progress` — КРЕСТ status='completed', completed_at + final_exam_passed_at; «10 писем» status='unlocked'
- `student_block_daily_cross` — 1 фото за 2026-05-10
- `student_location_attempts` — несколько попыток (audio + video_note) с реальной Deepgram транскрипцией

**Storage:**
- `block-resources` — 5 файлов (~21 MB)
- `student-recitations` — приватный, голосовые местописаний + пересказа
- `student-cross-photos` — приватный, ежедневные фото

**Функции:** `is_admin`, `is_visible_to`, `get_leader_chat_id`, `update_updated_at_column`, `is_block_unlocked` (Stage 4), `handle_new_user`, `update_cohort_member_count`.

---

*Версия 13.0 | 2026-05-10 | AI-first MVP полностью собран. Демо проверено end-to-end. Следующая сессия — production deployment.*
