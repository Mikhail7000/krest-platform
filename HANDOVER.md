# HANDOVER — КРЕСТ
> Дата: 2026-05-01 (ночь) | Сессия: ✅ Этап Б шаги 0+1 завершены и закоммичены; следующая сессия — шаг 2 (ресурсы Блока 1)

---

## 🎯 Главное (читать первым)

1. **Ветка:** `feat/nextjs-miniapp-poc`, последний коммит `f07460a`. **В main не сливать.**
2. **БД продакшн (`aejhlmoydnhgedgfndql`) пересобрана под v3.0:** 10 пустых блоков курса КРЕСТ, мультикурс, гео, 4-уровневая иерархия ролей, владелец защищён.
3. **Михаил = super_admin + is_protected=TRUE.**
4. **Supabase MCP tools НЕ доступны в текущем runtime** (claude 2.1.118 + VS Code). Миграции применяются вручную через Dashboard SQL Editor — Claude генерирует SQL и кладёт в чат, Михаил вставляет в `https://supabase.com/dashboard/project/aejhlmoydnhgedgfndql/sql/new` и жмёт Run. См. `memory/feedback_supabase_mcp_unavailable.md`.
5. **Только русский на старте.** EN — позже отдельной БД.
6. **Maintenance mode активен** (Михаил — whitelist по chat_id 255214568 + `?bypass=<token>`).

---

## ✅ Что сделано в этой сессии (2026-05-01 вечер→ночь)

### Этап Б шаг 0 — Фундамент (commit `91881ed`)

Миграция `supabase/migrations/20260501120000_v3_foundation.sql`:
- Создана `courses` + seed (КРЕСТ active, 10 писем coming_soon)
- `blocks`: добавлены `course_id, slug`, индексы; wipe старых 6 блоков; seed 10 новых блоков КРЕСТ с правильными названиями и слагами
- Удалены legacy таблицы v2.0: `cohorts, cohort_members, churches, pastor_subscriptions, streak_logs, block_rejections`
- TRUNCATE `uploads, bible_verses, journal_entries, weekly_submissions, student_progress, lessons, blocks` (прод данных не было — maintenance активен)
- `profiles`: дроп `church_id, streak_count, last_active_date`
- Создана `countries` (9 стран ISO) + `cities` (28 городов, **только Бали active**)
- RLS на новых таблицах

**Verified:** 2 курса, 10 блоков, 28 городов (1 active).

### Этап Б шаг 1 — Роли и иерархия (commit `f07460a`)

Миграция `supabase/migrations/20260501130000_v3_roles_hierarchy.sql`:
- `is_admin()` расширена до `('admin', 'super_admin')` — ДО смены ролей, иначе сломали бы все RLS
- `profiles.role` CHECK расширен: `student / curator / admin / super_admin`
- Удалены legacy колонки: `gornitsa_type, region, city (TEXT), blocks_unlocked`
- Добавлены `country_id, city_id` (FK на новые таблицы)
- `nastavnik_id` переименован в `curator_id` (данные сохранены)
- Создан `is_protected BOOLEAN`; Михаил → `role='super_admin', is_protected=TRUE`
- Создана `course_progress` + backfill: всем существующим профайлам открыт КРЕСТ как `unlocked`
- Создана `role_change_log` (audit ролей; SELECT/INSERT только для admin+)
- Создана PL/pgSQL функция `is_visible_to(viewer, target)` — видимость по прогрессии
- RLS-политики через `is_visible_to` на `profiles` и `course_progress`

**Verified:** `sleezard@gmail.com → super_admin → is_protected=true`.

---

## 🛤 Что НЕ сделано в этой сессии

### Этап Б шаг 1 — UI часть

В шаге 1 по плану ещё **UI назначения ролей в `/admin/roles`** (super_admin может менять роли + прикреплять учеников к кураторам). БД-часть готова, UI отложен — стыкуется со следующими шагами и будет полезнее когда появится поток учеников.

### Этап Б шаг 2 — Ресурсы Блока 1 (СЛЕДУЮЩИЙ)

Это будет **первая большая фича-задача**. Что нужно:

1. **Миграция `block_resources`:**
   ```sql
   CREATE TABLE block_resources (
     id UUID PK, block_id INT FK, resource_type TEXT
       CHECK IN ('main_video','additional_video','audio_prayer','pdf_prayer','guide_pdf','transcript'),
     title_ru TEXT, kinescope_id TEXT, storage_path TEXT,
     transcript_md TEXT, order_num INT, is_required BOOLEAN, ...
   );
   ```
   + RLS (SELECT для всех authenticated, ALL для super_admin) + индексы
2. **Storage bucket `block-resources`** (Supabase) — public read, upload только для super_admin/admin
3. **Скрипт `scripts/upload-resources.ts`** — пройдётся по `~/Desktop/Капсула крест материалы /1 Малый Крест/`:
   - Прочитает Kinescope ID для основного и доп. видео из `Кинескоп ссылки на видео.rtf`
   - Загрузит 2 m4a-молитвы в Storage `block-resources/01-maly-krest/audio/`
   - Загрузит 2 PDF (молитвы текстом) в Storage `block-resources/01-maly-krest/pdf/`
   - Загрузит гайд «Эпоха пятницы» PDF
   - Прочитает транскрипцию из `.rtf/.txt` файла → запишет в `block_resources.transcript_md`
   - Заполнит таблицу `block_resources` ссылками
4. **UI `/m/lesson/1` (или `[blockId]`)** — отображение ресурсов:
   - Видео в Kinescope iframe (no-skip overlay реализуется на шаге 3 вместе с auto-approve)
   - Аудио-плеер для m4a-молитв
   - Скачивание PDF
   - Показ транскрипции (опционально, под катом)

### Этап Б шаги 3-16

Не начаты. План в `docs/spec-first/03-block1-maly-krest.md` секция 12.

---

## 📂 Состояние БД на 2026-05-01 (ночь)

**Таблицы public schema (после двух миграций v3):**
- `profiles` (с новыми колонками: `country_id, city_id, curator_id, is_protected`; legacy дропнуты)
- `courses` (2 строки: krest, 10-pisem)
- `blocks` (10 строк курса КРЕСТ, все пустые — без видео-ID, без транскрипций)
- `lessons` (пусто)
- `bible_verses` (пусто)
- `student_progress` (пусто)
- `journal_entries` (пусто)
- `uploads` (пусто)
- `weekly_submissions` (пусто)
- `countries` (9 строк)
- `cities` (28 строк, 1 active=Бали)
- `course_progress` (по 1 записи на каждый существующий профайл, status='unlocked' на курсе КРЕСТ)
- `role_change_log` (пусто)
- `notifications_log` (как было до v3)
- `auth.*` — Supabase auth, не трогали

**Функции:**
- `is_admin()` — обновлена под super_admin
- `is_visible_to(viewer, target)` — новая
- `update_updated_at_column()` — общая trigger-функция
- `update_cohort_member_count()` — осталась от v2.0 (cohorts удалены, можно дропнуть позже как cleanup)

**Удалены v2.0 legacy таблицы:** cohorts, cohort_members, churches, pastor_subscriptions, streak_logs, block_rejections.

---

## ⚠️ Технические ограничения этой сессии

**Supabase MCP tools `apply_migration / execute_sql / list_tables` НЕ выгружены runtime'ом** в VS Code Claude SDK 2.1.118, хотя `claude mcp list` показывает supabase как `✓ Connected`. Это касается и субагентов.

**Альтернативы тоже не работают:**
- `psql` не установлен в системе
- `npm install pg` заблокирован Bash permissions
- Direct DB connection `db.aejhlmoydnhgedgfndql.supabase.co:5432` — IPv6-only без IPv4 add-on
- `supabase` CLI не установлен и проект не залинкован

**Рабочий путь:** Claude пишет полный SQL миграции, кладёт в чат с прямой ссылкой на SQL Editor → Михаил вставляет → Run. Шаги 0 и 1 пройдены так успешно. Применение одной миграции занимает ~30 секунд.

**Для будущих сессий:** проверить выгрузку MCP tools после перезапуска Claude Code. Если по-прежнему не работают — может быть стоит дать `npm install` в `additionalAllowedCommands` settings.json (уже есть в большинстве проектов, но конкретно тут заблокирован).

---

## 📂 Ключевые файлы и пути

**Миграции v3 (применены):**
- `supabase/migrations/20260501120000_v3_foundation.sql`
- `supabase/migrations/20260501130000_v3_roles_hierarchy.sql`

**Где материалы курса:**
- `/Users/rogue/Desktop/Капсула крест материалы /` (⚠️ пробел в конце!)
- Все 12 транскрипций на месте, все 14 Kinescope ID в `Кинескоп ссылки на видео.rtf`
- ⚠️ `/Users/rogue/Desktop/СКРИНЫ С ЧАТА КРЕСТ КАПСУЛА/` — НЕ ТРОГАТЬ

**Спеки и правила (актуально):**
- `SPEC.md` v3.0 — техспека
- `UI_UX_BRIEF.md` v3.0 — дизайн
- `CLAUDE.md` v3.0 — гайды
- `.claude/rules/church-platform.md` — доменные правила
- `docs/spec-first/03-block1-maly-krest.md` — план реализации (16 этапов в секции 12)

**Активные аккаунты:**
| Роль | Identifier | Где креды |
|------|------------|-----------|
| super_admin (protected) | sleezard@gmail.com / chat_id 255214568 / DB password `237` | memory/admin_credentials.md |
| Telegram bot (прод) | @cross_bot | env: TELEGRAM_BOT_TOKEN |
| Telegram bot (тест PoC) | @Cross_Capsule_Test_bot | токен у Михаила |
| Production URL | https://krest-platform-web.vercel.app/ | maintenance gate |
| Preview PoC | https://krest-platform-j7j95rmw6-mikhail7000s-projects.vercel.app/m/dashboard | — |

---

## 🚀 Что делать в начале новой сессии

### Старт
1. **Прочитать `HANDOVER.md`** (этот файл)
2. **`CLAUDE.md`** v3.0 (загрузится автоматически)
3. **`memory/MEMORY.md`** — индекс памяти. Особенно:
   - `feedback_supabase_mcp_unavailable.md` — про обход MCP
   - `project_materials_location.md` — где материалы Блока 1
   - `feedback_ask_about_missing.md` — если чего-то нет — спросить
4. **`docs/spec-first/03-block1-maly-krest.md`** секция 2 (ресурсы Блока 1) + секция 12 (этап 2 плана)

### Команды
```bash
git status && git log --oneline -5
git checkout feat/nextjs-miniapp-poc
ls "/Users/rogue/Desktop/Капсула крест материалы /1 Малый Крест/"
```

### Этап Б шаг 2 — план реализации

1. **Миграция** `supabase/migrations/{ts}_v3_block_resources.sql` — таблица `block_resources` + индексы + RLS. Применить через Dashboard SQL Editor.
2. **Storage bucket `block-resources`** — создать через Dashboard или скриптом с service_role. Public read, upload только super_admin.
3. **Скрипт заливки** `scripts/upload-resources.ts`:
   - Использует `SUPABASE_SERVICE_ROLE_KEY` из `apps/web/.env.local`
   - Проходится по папке Блока 1 (с пробелом в конце имени!)
   - Парсит `.rtf` файл с Kinescope ID (формат RTF — нужен парсер или regex по plaintext)
   - Загружает m4a + PDF в Storage
   - Insert в `block_resources` через `@supabase/supabase-js`
4. **UI `/m/lesson/[blockId]/page.tsx`** — Server Component, читает `block_resources` через Supabase, отображает:
   - Заголовок блока + описание
   - Kinescope iframe (одноразово, без no-skip overlay — это шаг 3)
   - Список аудио-молитв (только для Блока 1) с `<audio>` плеером
   - Кнопки скачивания PDF
   - Кнопка «Открыть транскрипцию» (collapsible)

### Что обязательно проверить ПЕРЕД шагом 2

- Вся ли информация в `Кинескоп ссылки на видео.rtf` парсится одинаково (формат, кодировка)
- Какой формат у транскрипций — `.rtf`, `.docx`, `.txt`? От этого зависит парсер
- Есть ли проблемы с пробелом в имени папки при чтении из Node.js (`/Users/rogue/Desktop/Капсула крест материалы /...`)

---

## 📌 Договорённость по работе со скриншотами

Без изменений с прошлого handover:
1. Скриншоты сохранять на диск в `notes/screenshots/`, не вставлять из буфера
2. Перед тяжёлой сессией со скринами — `/handoff` + новая сессия
3. `/compact` когда контекст забивается
4. Текст вместо скриншота, где можно (логи, ошибки, код)
5. 5-7 скринов в сессии — норма, 20+ — гарантированная проблема

---

## 🤖 Команда субагентов

| Агент | Модель | Зона |
|-------|--------|------|
| `database-architect` | Opus | Миграции (применять — через Dashboard, MCP не работает) |
| `backend-engineer` | Sonnet | API routes, скрипт заливки, Telegram, Storage |
| `frontend-developer` | Sonnet | React/TS — Next.js MiniApp + админка + сайт |
| `content-manager` | Sonnet | Парсинг материалов, заливка контента |
| `qa-reviewer` | Sonnet | Code review + RLS audit |
| `agent-architect` | Opus | Координация при больших миграциях |

---

*Версия 8.0 | 2026-05-01 (ночь) | Этап Б шаги 0+1 закоммичены; шаг 2 (ресурсы Блока 1) — следующая сессия*
