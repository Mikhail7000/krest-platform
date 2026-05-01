# HANDOVER — КРЕСТ
> Дата: 2026-05-01 (поздняя ночь) | Сессия: ✅ Этап Б шаги 0+1 закоммичены ранее; **Supabase MCP починен** (`.mcp.json` обновлён, требуется рестарт Claude Code) — следующая сессия начинает шаг 2 (ресурсы Блока 1) уже через рабочий MCP

---

## 🎯 Главное (читать первым)

1. **Ветка:** `feat/nextjs-miniapp-poc`, последний коммит `a41abef`. **В main не сливать.**
2. **БД продакшн (`aejhlmoydnhgedgfndql`) уже пересобрана под v3.0:** 10 пустых блоков курса КРЕСТ, мультикурс, гео, 4-уровневая иерархия ролей, владелец защищён.
3. **Михаил = super_admin + is_protected=TRUE.**
4. **Supabase MCP теперь работает** — корневая причина прошлой невыгрузки tools найдена и исправлена. См. секцию «Что случилось в мини-сессии 2026-05-01 ночь» ниже.
5. **Только русский на старте.** EN — позже отдельной БД.
6. **Maintenance mode активен** (Михаил — whitelist по chat_id 255214568 + `?bypass=<token>`).

---

## 🆕 Что случилось в мини-сессии 2026-05-01 ночь

Михаил поставил задачу: разобраться, почему Supabase MCP не выгружает инструменты, хотя `claude mcp list` пишет `✓ Connected`. Разобрались.

### Корневая причина

`@supabase/mcp-server-supabase` версий **0.7.0 и 0.8.0** содержит регрессию в feature `docs`. На запросе `tools/list` сервер обращается к Supabase Content API за списком search-инструментов; ответ API не проходит Zod-валидацию (`Failed to parse Supabase Content API response: invalid_union ... errors expected nonoptional, received undefined`); сервер вместо списка инструментов возвращает JSON-RPC error `-32603`.

`initialize` при этом проходит нормально → `claude mcp list` показывает «Connected» → MCP-клиент Claude видит ошибку на `tools/list` и принимает «инструментов нет». Из-за этого баг очень обманчив — connection ОК, инструментов нет.

### Фикс

В `.mcp.json` добавлен явный `--features` без `docs`:

```json
"args": [
  "-y",
  "@supabase/mcp-server-supabase@latest",
  "--project-ref=aejhlmoydnhgedgfndql",
  "--features=database,debug,development,functions,storage,account,branching"
]
```

Проверка вручную (запуск через stdio + handshake) подтвердила: с `--features` сервер отдаёт 17+ инструментов: `list_tables, apply_migration, execute_sql, get_logs, get_advisors, get_project_url, get_publishable_keys, generate_typescript_types, list_edge_functions, get_edge_function, deploy_edge_function, create_branch, list_branches, delete_branch, merge_branch, reset_branch, list_extensions, list_migrations` — всё что нужно.

### Что закоммичено и что нет

`.mcp.json` остаётся в `.gitignore` — он содержит `SUPABASE_ACCESS_TOKEN` (личный токен Михаила, не должен попадать в git). Вместо этого в репо лежит **`.mcp.json.example`** — копия рабочего конфига с фиксом `--features` и плейсхолдером `<YOUR_SUPABASE_ACCESS_TOKEN>` вместо реального токена.

Чтобы поднять MCP в свежем клоне репо:
```bash
cp .mcp.json.example .mcp.json
# открыть .mcp.json и подставить SUPABASE_ACCESS_TOKEN
```

`apps/web/next-env.d.ts` (auto-generated, всегда модифицирован) — НЕ стейджить.

### Status в memory

Заметка `feedback_supabase_mcp_unavailable.md` переписана: теперь там корневая причина + рецепт фикса. В индексе `MEMORY.md` подпись обновлена.

---

## ✅ Что было сделано в основной сессии 2026-05-01 (вечер→ночь, до мини-сессии)

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

## 🛤 Что НЕ сделано

### Этап Б шаг 1 — UI часть (отложено)

В шаге 1 по плану ещё **UI назначения ролей в `/admin/roles`** (super_admin может менять роли + прикреплять учеников к кураторам). БД-часть готова, UI отложен — стыкуется со следующими шагами и будет полезнее когда появится поток учеников.

### Этап Б шаг 2 — Ресурсы Блока 1 (СЛЕДУЮЩИЙ — теперь через MCP)

Это **первая большая фича-задача**. Что нужно:

1. **Миграция `block_resources`** (теперь через `mcp__supabase__apply_migration`, не Dashboard):
   ```sql
   CREATE TABLE block_resources (
     id UUID PK, block_id INT FK, resource_type TEXT
       CHECK IN ('main_video','additional_video','audio_prayer','pdf_prayer','guide_pdf','transcript'),
     title_ru TEXT, kinescope_id TEXT, storage_path TEXT,
     transcript_md TEXT, order_num INT, is_required BOOLEAN, ...
   );
   ```
   + RLS (SELECT для всех authenticated, ALL для super_admin) + индексы
2. **Storage bucket `block-resources`** (Supabase) — public read, upload только для super_admin/admin (можно создать через Dashboard или серверным скриптом с service_role)
3. **Скрипт `scripts/upload-resources.ts`** — пройдётся по `~/Desktop/Капсула крест материалы /1 Малый Крест/`:
   - Прочитает Kinescope ID для основного и доп. видео из `Кинескоп ссылки на видео.rtf` (он в RTF с Unicode-эскейпами `\u<digits>` для русских букв; ссылки `https://kinescope.io/<id>` — выудить regex'ом по plaintext)
   - Загрузит 2 m4a-молитвы в Storage `block-resources/01-maly-krest/audio/`
   - Загрузит 2 PDF (молитвы текстом) в Storage `block-resources/01-maly-krest/pdf/`
   - Загрузит гайд «Эпоха пятницы» PDF (исходник — `.rtfd` бандл с TXT.rtf + Attachment.png; PDF нужно сгенерировать ИЛИ оставить .rtfd как есть, обсудить с Михаилом)
   - Прочитает транскрипцию из `Транскрибация, малый крест видео. .txt` (это plain text, не RTF — упрощает парсинг) → запишет в `block_resources.transcript_md`
   - Заполнит таблицу `block_resources` ссылками
4. **UI `/m/lesson/[blockId]/page.tsx`** — Server Component:
   - Видео в Kinescope iframe (no-skip overlay реализуется на шаге 3 вместе с auto-approve)
   - Аудио-плеер для m4a-молитв
   - Скачивание PDF
   - Показ транскрипции (опционально, под катом)

### Подтверждённое содержимое папки Блока 1

```
1 Малый Крест/
├── 1 крест за 5 минут.mp4
├── Вводный урок.mp4
├── Вводный урок транскрибация видео.txt
├── Задание для учеников из первого блока Малый крест. .rtf  (9-пунктовое ДЗ от Алекса)
├── Молитва Крест Короткая (1).pdf
├── Молитва Крест Короткая.m4a
├── Молитва Крест Полная (1).pdf
├── Молитва Крест Полная.m4a
├── Транскрибация, малый крест видео. .txt
└── Эпоха пятницы. Гайд.rtfd/
    ├── Attachment.png
    └── TXT.rtf
```

### Kinescope ID (декодированы из RTF верхней папки)

| Видео | ID | Куда |
|---|---|---|
| Вводный урок | `ntfUqbL89b9mrGzrgKrLbW` | additional_video Блок 1 |
| Малый крест | `pSGDKsHr56JZVAeWVsWev3` | main_video Блок 1 |
| Принцип сотворения | `tJzZ6vsEsFdCMS4oonkZkD` | Блок 2 |
| Коренная проблема | `wdJq1c4WCiexnLQe1xsnph` | Блок 3 |
| Божье благословение | `3NUFJc6L1Q5cQcWA2B2HoZ` | (TBD) |
| Состояние мира | `sZMf83zHvoxHnSt5B5ukTS` | Блок 4 |
| Состояние неверующего | `ntk6dsQYPAeaxrmwDLNQr4` | Блок 5 |
| Усилия человека | `vJ4o2gm4gNdK5iQg6eGgiB` | Блок 6 |
| Обетования и исполнение | `71523EDPaiRHagahZgXzsf` | Блок 7 |
| Иисус Христос | `udb6rtAoEXLuBiWUtbF4pJ` | Блок 8 |
| Благословение верующего | `e82sBoBn5LHFgjGnHn4RTu` | Блок 9 |
| Пять Уверенностей | `33xbQzhgwU5riZ3XjVinUe` | Блок 10 |
| Инструкция для лидеров | `3iC4NbTjPJro4oWH3RKXpX` | curator-only |
| Вопрос-ответ | `tCqRddRoFVJ8PEhYeqTKrj` | Q&A |

Уточнить у Михаила: куда «Божье благословение» (ID `3NUFJc6L1Q5cQcWA2B2HoZ`) — это additional video для какого блока? Возможно вводное общее.

### Этап Б шаги 3-16

Не начаты. План в `docs/spec-first/03-block1-maly-krest.md` секция 12.

---

## 📂 Состояние БД на 2026-05-01 (ночь, без изменений с шага 1)

**Таблицы public schema:**
- `profiles` (с новыми колонками: `country_id, city_id, curator_id, is_protected`; legacy дропнуты)
- `courses` (2 строки: krest, 10-pisem)
- `blocks` (10 строк курса КРЕСТ, все пустые)
- `lessons` (пусто), `bible_verses` (пусто), `student_progress` (пусто)
- `journal_entries` (пусто), `uploads` (пусто), `weekly_submissions` (пусто)
- `countries` (9 строк), `cities` (28 строк, 1 active=Бали)
- `course_progress` (по 1 на каждый профайл, status='unlocked' на курсе КРЕСТ)
- `role_change_log` (пусто)
- `notifications_log` (как было до v3)

**Функции:**
- `is_admin()` — обновлена под super_admin
- `is_visible_to(viewer, target)` — новая
- `update_updated_at_column()` — общая trigger-функция
- `update_cohort_member_count()` — осталась от v2.0 (cohorts удалены, можно дропнуть позже как cleanup — это micro-задача, не блокер)

**Удалены legacy:** cohorts, cohort_members, churches, pastor_subscriptions, streak_logs, block_rejections.

---

## ⚙️ Технические условия следующей сессии

1. **MCP должен заработать после рестарта Claude Code.** Если внезапно нет — проверь:
   - `cat .mcp.json` — должен быть `--features=database,...,branching`
   - `claude mcp list` — supabase должен быть `✓ Connected`
   - Через ToolSearch: `select:mcp__supabase__apply_migration` — если не находит, MCP не выгрузил инструменты (rare — может из-за npx warm-up на первом запуске; перезапустить ещё раз)
   - В крайнем случае — fallback на ручную вставку SQL в Dashboard SQL Editor (как делали в шагах 0+1)
2. **Service role key** для скрипта заливки уже в `apps/web/.env.local` под именем `SUPABASE_SERVICE_ROLE_KEY` — не светить в браузерном коде.
3. **Папка с материалами с пробелом в конце имени:** `/Users/rogue/Desktop/Капсула крест материалы /` — все ls/Read/скрипты должны квотировать путь.
4. **Permissions Bash:** `npm install` / `npm run` / `node *` заблокированы в `.claude/settings.json deny`. Если для скрипта заливки понадобится `node scripts/upload-resources.ts` — нужно запросить разрешение у Михаила или временно whitelist'нуть конкретную команду.

---

## 📂 Ключевые файлы и пути

**Миграции v3 (применены):**
- `supabase/migrations/20260501120000_v3_foundation.sql`
- `supabase/migrations/20260501130000_v3_roles_hierarchy.sql`

**Новая планируемая:**
- `supabase/migrations/{timestamp}_v3_block_resources.sql`

**Конфигурация MCP:**
- `.mcp.json` — gitignored (содержит `SUPABASE_ACCESS_TOKEN`)
- `.mcp.json.example` — закоммичен; шаблон с фиксом `--features` без `docs`, токен в плейсхолдере

**Где материалы курса:**
- `/Users/rogue/Desktop/Капсула крест материалы /` (⚠️ пробел в конце!)
- ⚠️ `/Users/rogue/Desktop/СКРИНЫ С ЧАТА КРЕСТ КАПСУЛА/` — НЕ ТРОГАТЬ

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

### Сразу после старта

1. Прочитать `HANDOVER.md` (этот файл)
2. `CLAUDE.md` v3.0 (загрузится автоматически)
3. Проверить `.mcp.json` и попробовать любой Supabase MCP-tool — например `mcp__supabase__list_tables` — чтобы убедиться, что фикс работает после рестарта. Если в свежем клоне репо `.mcp.json` нет — `cp .mcp.json.example .mcp.json` и подставить `SUPABASE_ACCESS_TOKEN`.
4. Приступать к Этапу Б шагу 2

### План шага 2

См. секцию «Этап Б шаг 2 — Ресурсы Блока 1» выше. Порядок:
1. Миграция `block_resources` (через MCP `apply_migration`)
2. Storage bucket `block-resources` (через Dashboard или серверный скрипт)
3. Скрипт заливки `scripts/upload-resources.ts`
4. UI `/m/lesson/[blockId]`

Перед началом обязательно уточнить у Михаила, куда мапить «Божье благословение» Kinescope ID и нужно ли конвертировать `.rtfd` гайд «Эпоха пятницы» в PDF.

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
| `database-architect` | Opus | Миграции (теперь через MCP, не вручную) |
| `backend-engineer` | Sonnet | API routes, скрипт заливки, Telegram, Storage |
| `frontend-developer` | Sonnet | React/TS — Next.js MiniApp + админка + сайт |
| `content-manager` | Sonnet | Парсинг материалов, заливка контента |
| `qa-reviewer` | Sonnet | Code review + RLS audit |
| `agent-architect` | Opus | Координация при больших миграциях |

---

*Версия 9.0 | 2026-05-01 (поздняя ночь) | MCP-fix применён в `.mcp.json`, требуется рестарт Claude Code; шаг 2 — следующая сессия*
