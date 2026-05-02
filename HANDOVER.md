# HANDOVER — КРЕСТ
> Дата: 2026-05-03 (поздняя ночь) | Сессия: ✅ Этап Б шаг 2 закрыт коммитом `7b2a12d`. Блок 1 «Малый Крест» полностью наполнен (БД + Storage + UI), страница `/m/lesson/1` открывается локально и тестировалась пользователем. Следующая сессия — на выбор Михаила (см. секцию «Куда дальше»).

---

## 🎯 Главное (читать первым)

1. **Ветка:** `feat/nextjs-miniapp-poc`, последний коммит `7b2a12d`. **В main не сливать.**
2. **БД продакшн (`aejhlmoydnhgedgfndql`):** v3.0 фундамент + роли + `block_resources` (7 строк для Блока 1). Storage bucket `block-resources` (private, 5 файлов).
3. **MCP Supabase работает** — тулзы `apply_migration`, `execute_sql`, `list_tables`, `list_storage_buckets`, `generate_typescript_types` уже использовались в этой сессии и вели себя корректно.
4. **Только русский на старте.** EN — позже отдельной БД.
5. **Maintenance mode активен** для `/admin/*` и лендинга, `/m/*` пропускается без gate (для PoC и продолжения миграции в Next.js MiniApp).

---

## ✅ Что сделано в сессии 2026-05-02 → 2026-05-03

### 1. MCP fix зафиксирован (commit `5cefc3a`)

`.mcp.json` остаётся в `.gitignore` (там личный `SUPABASE_ACCESS_TOKEN`). В репо лежит `.mcp.json.example` с фиксом `--features=database,debug,development,functions,storage,account,branching` (исключает сломанную фичу `docs`). Для свежего клона репо: `cp .mcp.json.example .mcp.json` + подставить токен.

### 2. Этап Б шаг 2 — Ресурсы Блока 1 «Малый Крест» (commit `7b2a12d`)

**БД:** миграция `supabase/migrations/20260502120000_v3_block_resources.sql`
- Таблица `block_resources` (12 колонок: id, block_id, resource_type, title_ru, description_ru, kinescope_id, storage_path, transcript_md, order_num, is_required, created_at, updated_at)
- CHECK на `resource_type` ∈ `main_video / additional_video / audio_prayer / pdf_prayer / guide_pdf / transcript`
- RLS + 2 политики (SELECT для authenticated, ALL для admin)
- 3 индекса + триггер `updated_at`

**Storage:** миграция `supabase/migrations/20260502130000_v3_storage_block_resources.sql`
- Приватный bucket `block-resources` (50 MB лимит, MIME whitelist: m4a, mp3, pdf, png, jpg, webp)
- 4 политики на `storage.objects` для admin-only прямого доступа
- Ученики получают ресурсы только через signed URL (генерация на сервере с service_role, обходит RLS)

**Скрипт заливки:** `scripts/upload-resources.mjs` (Node ESM, без npm-зависимостей)
- Парсит `Кинескоп ссылки на видео.rtf`, `Транскрибация...txt`, `Вводный урок транскрибация.txt`
- Парсит `Эпоха пятницы. Гайд.rtfd/TXT.rtf` → markdown (минимальный inline RTF-парсер, обработка `\u<dec>` и `\'XX` cp1252)
- Заливает 5 файлов в Storage (с `x-upsert: true` — идемпотентно)
- DELETE existing block_resources for block_id=1 → INSERT заново (идемпотентно)
- Запускается через `set -a; source apps/web/.env.local; set +a; node scripts/upload-resources.mjs` от корня репо
- ⚠ В `.claude/settings.json deny` стоит `Bash(node *)` → Михаил запускает скрипт сам в своём терминале, Claude не запускает напрямую. После успешного запуска **`SUPABASE_SERVICE_ROLE_KEY` в .env.local — новый, после rotate** (старый утёк в чат и был немедленно отозван, см. memory/feedback_secret_handling.md).

**UI:** Server Component `apps/web/src/app/m/lesson/[blockId]/page.tsx` + `lesson.css`
- Загрузка через service_role (не utечка — Server Component рендерится только на сервере)
- Generate signed URLs для всех `storage_path` пакетно через `createSignedUrls(paths, 3600)`
- Видео — Kinescope iframe в обёртке 16:9 (no-skip overlay будет в шаге 3)
- Транскрипты под `<details>` (нативный HTML, без JS)
- Аудио — HTML5 `<audio controls>`
- PDF — `<a download>`-кнопки
- Гайд «Эпоха пятницы» — золотая рамка, картинка + текст

**Дашборд:** в `/m/dashboard/page.tsx` добавлена карточка с кнопкой «Открыть блок →» на `/m/lesson/1`.

**TypeScript types:** `packages/supabase/src/types.ts` обновлён через `mcp__supabase__generate_typescript_types`. Добавлена `block_resources`, поправлены v3.0-поля profiles (`country_id`, `city_id`, `curator_id`, `is_protected`).

**Локальное тестирование:** Михаил запустил `npx next dev`, открыл `/m/dashboard` и `/m/lesson/1` — подтвердил «всё работает».

### 3. Memory обновлена

- `feedback_secret_handling.md` — никогда не принимать полные секреты в чате; просить только короткий префикс
- `project_kinescope_mapping.md` — полный маппинг 14 Kinescope ID → блоки; «Божье благословение» = additional_video Блок 2 «Принцип сотворения»

---

## 🛤 Что НЕ сделано / что в долге

### Этап Б шаг 1 (UI часть) — отложено

UI назначения ролей в `/admin/roles` (super_admin меняет роли + прикрепляет учеников к кураторам). БД-часть готова (commit `f07460a`), UI отложен до момента когда появится поток учеников.

### Этап Б шаг 3 — No-skip overlay для Kinescope (НЕ начат)

После шага 2:
- Кастомный overlay поверх iframe (Framer Motion + polling currentTime каждые 500мс)
- При `currentTime > maxWatched + 2` → принудительно `seekTo(maxWatched)`
- При `maxWatched / duration ≥ 0.95` → создаётся submission `auto_approved`
- Это уже client-side компонент, потребует Supabase browser client + кнопка отметки

### Этап Б шаги 4-16 — НЕ начаты

Полный план в `docs/spec-first/03-block1-maly-krest.md` секция 12. Главные оставшиеся:
- Шаг 4: Онбординг (язык/страна/город/куратор)
- Шаг 5+: 12-пунктовое ДЗ (full submission flow)
- Шаг 6+: Календарь активности куратора
- Шаг 7+: Форум-рефлексия + чат с куратором

### Технические долги

| Долг | Где | Приоритет |
|---|---|---|
| `.claude/agents/agent-architect.md` описывает legacy v2.0 архитектуру (vanilla MiniApp + ai-agent-architect) | `.claude/agents/agent-architect.md` | low — обновить под v3.0 одним редактом, не блокер |
| Legacy TS errors в `apps/web/src/app/admin/*` и `student/*` (ссылки на удалённые `nastavnik_id`, `blocks_unlocked`, `gornitsa_type`, `city`, etc) | 22 ошибки, не в наших новых файлах | medium — мигрировать страницы под v3.0 поля или удалить если не используются |
| Next.js 16: `middleware.ts` deprecated, нужно переименовать в `proxy.ts` | `apps/web/src/middleware.ts` | low — warning, не блокер |
| Залить Блоки 2-10 (только Блок 1 наполнен) | папки `2 Принцип сотворения` … `10 Пять Уверенностей` в `~/Desktop/Капсула крест материалы /` | medium — повторить логику скрипта для остальных блоков, по мере готовности материалов |
| Дизайн hero лендинга через Midjourney | Михаил подбирает кадр (был в работе в этой сессии — отложено) | medium |

### Что NOT в working tree (untracked, но не код)

- `notes/cherновое-tz-michail.md` — твой черновой документ, untracked, не трогать.

---

## 📂 Состояние БД и Storage на 2026-05-03

**Таблицы public schema** (14, без изменений с шага 1 + добавлена block_resources):
- `profiles` (10 строк)
- `courses` (2: krest active, 10-pisem coming_soon)
- `blocks` (10 — все 10 блоков КРЕСТ; только Блок 1 наполнен ресурсами)
- `block_resources` (7 строк для block_id=1):
  - main_video «Малый Крест» (Kinescope `pSGDKsHr56JZVAeWVsWev3`) + transcript 3806 chars
  - additional_video «Вводный урок» (Kinescope `ntfUqbL89b9mrGzrgKrLbW`) + transcript 5239 chars
  - audio_prayer × 2 (Молитва Короткая + Полная m4a)
  - pdf_prayer × 2 (Молитва Короткая + Полная PDF)
  - guide_pdf «Эпоха пятницы — Гайд» + transcript 3994 chars + картинка
- `lessons` (пусто), `bible_verses` (пусто), `student_progress` (пусто), `journal_entries` (пусто), `uploads` (пусто), `weekly_submissions` (пусто)
- `countries` (9), `cities` (28, 1 active=Бали)
- `course_progress` (10 строк, все unlocked для КРЕСТ)
- `role_change_log` (пусто)
- `notifications_log` (как было)

**Storage:**
- Bucket `block-resources` — приватный, 5 файлов в `01-maly-krest/`:
  - `audio/molitva-korotkaya.m4a` (5.7 MB)
  - `audio/molitva-polnaya.m4a` (15.2 MB)
  - `pdf/molitva-korotkaya.pdf` (49 KB)
  - `pdf/molitva-polnaya.pdf` (84 KB)
  - `guide/attachment.png` (1.6 KB)
- ~21 MB суммарно
- 4 политики admin-only на `storage.objects`

**Функции:**
- `is_admin()` — `super_admin` + `admin`
- `is_visible_to(viewer, target)` — видимость по прогрессии
- `update_updated_at_column()` — общий триггер
- `get_leader_chat_id()` — для уведомлений
- `update_cohort_member_count()` — наследие v2.0 (cohorts удалены), можно дропнуть как cleanup

---

## ⚙️ Технические условия следующей сессии

### Окружение

1. **MCP Supabase** должен заработать после рестарта (`.mcp.json.example` лежит в репо). Если в свежем клоне нет `.mcp.json` — `cp .mcp.json.example .mcp.json` и подставить `SUPABASE_ACCESS_TOKEN` в env-блок.
2. **Supabase service_role** — в `apps/web/.env.local` под `SUPABASE_SERVICE_ROLE_KEY`. **Это новый ключ** (старый отозван 2026-05-02 после случайного раскрытия в чате). Формат `sb_secret_...`, ~41 символ.
3. **Папка с материалами с пробелом в конце имени:** `/Users/rogue/Desktop/Капсула крест материалы /` — все ls/Read/скрипты должны квотировать путь.
4. **Permissions Bash:** `npm install` / `npm run` / `node *` заблокированы в `.claude/settings.json deny`. Запуск скриптов — Михаил у себя в терминале (вариант A из обсуждения шага 2.3). Если потребуется обойти deny — отдельное решение.

### Безопасность секретов

- Никогда не запрашивать у Михаила полные API-ключи / токены / пароли в чате. Только префикс из 4-6 символов с инструкцией «остальное замажь звёздочками». См. `memory/feedback_secret_handling.md`.

### Процесс

- Все DDL — через `mcp__supabase__apply_migration` (НЕ Dashboard SQL Editor).
- Все DML/SELECT — через `mcp__supabase__execute_sql`.
- Storage — через REST с service_role (см. `scripts/upload-resources.mjs` как эталон).

---

## 📂 Ключевые файлы и пути

**Миграции v3 (применены):**
- `supabase/migrations/20260501120000_v3_foundation.sql`
- `supabase/migrations/20260501130000_v3_roles_hierarchy.sql`
- `supabase/migrations/20260502120000_v3_block_resources.sql`
- `supabase/migrations/20260502130000_v3_storage_block_resources.sql`

**Новые в шаге 2 (закоммичены):**
- `scripts/upload-resources.mjs`
- `apps/web/src/app/m/lesson/[blockId]/page.tsx`
- `apps/web/src/app/m/lesson/[blockId]/lesson.css`
- `apps/web/src/app/m/dashboard/page.tsx` (модифицирован: добавлена кнопка «Открыть блок 1»)
- `packages/supabase/src/types.ts` (регенерирован)

**Конфигурация MCP:**
- `.mcp.json` — gitignored (содержит `SUPABASE_ACCESS_TOKEN`)
- `.mcp.json.example` — закоммичен; шаблон с фиксом `--features` без `docs`, токен в плейсхолдере

**Где материалы курса:**
- `/Users/rogue/Desktop/Капсула крест материалы /` (⚠ пробел в конце!)
- ⚠ `/Users/rogue/Desktop/СКРИНЫ С ЧАТА КРЕСТ КАПСУЛА/` — НЕ ТРОГАТЬ

**Спеки и правила (актуально):**
- `SPEC.md` v3.0, `UI_UX_BRIEF.md` v3.0, `CLAUDE.md` v3.0
- `.claude/rules/church-platform.md`
- `docs/spec-first/03-block1-maly-krest.md` секция 2 (ресурсы) + секция 12 (план 16 этапов)

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

### Сразу после старта — фраза для Михаила

Открой Claude Code в проекте и напиши:

> Прочитай HANDOVER.md и memory/MEMORY.md. Потом скажи, в каком мы состоянии и какие у меня варианты что делать дальше — ничего не запускай.

После этого Claude Code:
1. Прочитает HANDOVER (этот файл) и индекс памяти
2. Сразу будет в курсе всего, что мы сделали
3. Не будет лезть в код / БД / MCP без подтверждения

### Куда дальше — варианты на выбор

| Вариант | Описание | Размер |
|---|---|---|
| **A.** Этап Б шаг 3 — no-skip overlay для Kinescope | Видео нельзя скипать; при ≥95% пункт авто-approved | 1 сессия |
| **B.** Этап Б шаг 4 — онбординг (язык/страна/город/куратор) | Регистрация ученика по гео-цепочке | 1-2 сессии |
| **C.** Дизайн лендинга — hero на 100vh | Midjourney + Tailwind hero с цифрами 237/5000/7000/7000 + Матфея 28:18-20 | 1 сессия (когда будет готовая Midjourney картинка) |
| **D.** Этап Б шаг 5+ — 12-пунктовое ДЗ | Полный flow прохождения блока с сабмишенами | 2-3 сессии |
| **E.** Push в remote + Vercel preview | Залить ветку на GitHub, проверить на проде через `@Cross_Capsule_Test_bot` | 30 минут |
| **F.** Залить материалы Блоков 2-10 | Расширить `scripts/upload-resources.mjs` на оставшиеся блоки (когда материалы готовы) | 30-60 минут |
| **G.** Закрыть технические долги | Поправить `agent-architect.md` под v3.0, обновить legacy `admin/*` страницы под новые поля profiles, мигрировать `middleware.ts` → `proxy.ts` | 1 сессия |

Михаил выбирает на старте новой сессии. Если пишет «продолжаем» без уточнения — по умолчанию идёт вариант A (это следующий шаг по плану в `docs/spec-first/03-block1-maly-krest.md`).

---

## 📌 Договорённость по работе со скриншотами (без изменений)

1. Скриншоты сохранять на диск в `notes/screenshots/`, не вставлять из буфера
2. Перед тяжёлой сессией со скринами — `/handoff` + новая сессия
3. `/compact` когда контекст забивается
4. Текст вместо скриншота, где можно (логи, ошибки, код)
5. 5-7 скринов в сессии — норма, 20+ — гарантированная проблема

---

## 🤖 Команда субагентов

| Агент | Модель | Зона |
|-------|--------|------|
| `database-architect` | Opus | Миграции (через MCP `apply_migration`) |
| `backend-engineer` | Sonnet | API routes, скрипты заливки, Telegram, Storage |
| `frontend-developer` | Sonnet | React/TS — Next.js MiniApp `/m/*` + админка `/admin/*` + лендинг |
| `content-manager` | Sonnet | Парсинг материалов, заливка контента |
| `qa-reviewer` | Sonnet | Code review + RLS audit (без Write) |
| `agent-architect` | Opus | Координация при больших миграциях. ⚠ Файл агента содержит legacy v2.0 описание — обновить под v3.0 одним редактом. |

---

*Версия 10.0 | 2026-05-03 (поздняя ночь) | Этап Б шаг 2 закрыт коммитом `7b2a12d`. Блок 1 «Малый Крест» полностью наполнен и работает в `/m/lesson/1`. Михаил выбирает следующий шаг на старте новой сессии.*
