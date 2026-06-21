# HANDOVER — КРЕСТ (2026-06-22)

Передача контекста между сессиями. Цель: ничего не теряется, следующая сессия продолжает без раскопок.
Полные спеки фич (с критикой агентов) — в [docs/feature-specs/2026-06-backlog-specs.json](docs/feature-specs/2026-06-backlog-specs.json).
Прошлый онбординг-handover (2026-05-28) — в истории git, неактуален.

---

## 1. Что задеплоено в этой сессии (прод, push → Vercel auto-deploy на `main`)

Прод = `https://krest-platform-web.vercel.app`. Деплой = **push в `main`** (Vercel CLI не установлен; `.vercel` нет). Сигнал «выехало» — менялся статус нового/удалённого роута.

| Коммит | Что |
|---|---|
| `a6611a4` | Раздел **«Заявки»** `/panel/requests` + надёжная доставка (escapeHtml во всех admin-уведомлениях) |
| `4df8d8d` | В истории заявок — **кем и когда** принято решение (`decided_by` → имя) |
| `140fbe4` | Статус доставки Telegram-уведомления при одобрении заявки (`notified`) |
| `b46b123` | **Управление ролями** на `/panel/curators` (curator↔admin↔student) + усиление role-эндпоинта: self-guard, super_admin-only для админ-уровня, отвязка учеников при понижении, `role_change_log` аудит; удалён мёртвый `GET /api/panel/curators` |
| `56fe964` | Владелец (`is_protected`) видит скрытых тестировщиков (панель + бот) |
| `f00d951` | Сортировка списка учеников по клику на любой заголовок |
| `019e7d9` | Трекинг: поиск по имени/нику + фикс двойного `@@`; вечернее напоминание **20:00 Бали** (cron `stage=20`, миграция `reminded_20`) |

**Корневая причина пропавших уведомлений о заявках (диагностика):** (1) уведомление шлётся один раз при создании заявки, при сбое не повторяется; (2) имя с `< > &` в `parse_mode=HTML` → Telegram 400 → молча терялось. Оба пофикшены; панель `/panel/requests` — надёжный канал, читает из БД.

---

## 2. Бэклог из запроса Михаила (2026-06-22) — статус

| # | Запрос | Статус |
|---|---|---|
| 1 | Двойное `@@` в трекинге убрать | ✅ DONE (`019e7d9`) |
| 2 | Поиск в трекинге по имени/нику | ✅ DONE (`019e7d9`) |
| 3 | Напоминание ученику 20:00 («я и сам учился по вечерам…») | ✅ DONE (`019e7d9`) — Бали-fixed; per-tz см. #12 |
| 4 | Запросы новых учеников — всем админам | ✅ УЖЕ РАБОТАЕТ (`getAdminChatIds` = super_admin+admin); escaping пофикшен |
| 5 | **Веб-панель куратора** (ограниченная) + уведомления куратору в бот | 📋 SPEC `curator-panel` (L) |
| 6 | Куратор видит только своих (бот + веб) | 📋 SPEC `curator-panel` |
| 7 | Уведомление куратору при простое ученика >3 дней | 📋 SPEC `inactivity-and-settings` (M) |
| 8 | Настройки частоты уведомлений на каждого куратора | 📋 SPEC `inactivity-and-settings` |
| 9 | Фокус куратора на отдельных учениках | 📋 SPEC `focus-and-reports` (L) |
| 10 | Отчёт по выбранным ученикам (куратор — свои, админ — все) | 📋 SPEC `focus-and-reports` |
| 11 | Часовые пояса ученика → система двигается по местному поясу | 📋 SPEC `timezone-daygate` (L) |
| 12 | День выполнен → с 00:00 след. суток (пояс ученика) открыть след. день + уведомление | 📋 SPEC `timezone-daygate` |
| 13 | Богатый профиль (чем занимается, медиа, ссылки, «как пришёл к Богу») | 📋 SPEC `rich-profile` (M) |
| 14 | Трекинг: клик по человеку → его профиль + что писал в ленте | 📋 SPEC `rich-profile` (public `/m/u/[id]`) |
| 15 | Розовый фон для девочек | 📋 SPEC `pink-theme` (M) |
| 16 | Сделать приложение быстрее | 📋 SPEC `performance` (M) |

«📋 SPEC» = есть Spec-First дизайн + критика (раздел 4 + docs/feature-specs). Не реализовано — каждая фича требует фокусной сессии с миграциями/RLS. Делать «пачкой» вслепую на живой платформе нельзя (RLS-дыры, сломанные cron). Порядок — раздел 5.

---

## 3. КРИТИЧЕСКАЯ ПРАВДА КОДА (грабли, которые ловила критика — читать ДО реализации)

1. **Модель «закрытого дня» = 4 источника, НЕ 5.** Живой RPC (последняя миграция `20260620150000_v3_fix_locations_vs_peresказ.sql` перекрывает более ранние): день закрыт по `HAVING count(DISTINCT src)=4`: **крест + молитва + пересказ(audio) + местописания(video_note-locations)**. Квиз и тренажёр в gate НЕ входят (выпилены: `drop_quiz_from_gate`, `drop_trainer_from_gate`). `closed_dates_all`/`passed_blocks_all`/`user_closed_days`/`is_block_unlocked` переопределялись 5–12 раз — **берём ТОЛЬКО последнее живое определение**, не старые файлы.
2. **Всё по UTC, не по Бали и не по поясу ученика.** `submitted_date`/`prayed_date` = `new Date().toISOString().slice(0,10)` (UTC). Recitations/locations — `(created_at AT TIME ZONE 'UTC')::date`. `block-status/[blockId]` — `todayUTC()`. `profiles.last_active_date` — UTC. НО streak/worked (`lib/activity/worked.ts`) — по **Бали**. `cities.timezone` есть, но НЕ используется. Корень #11/#12.
3. **Панель на service-role, обходит RLS.** Scoping куратора (#5/#6) **нельзя** через Postgres RLS в панели — только в коде: фильтр `curator_id === session.uid` при `role==='curator'` на каждом data-пути. Главный риск curator-panel.
4. **Telegram-уведомлений «куратору» пока нет.** `notifyAdmins`/`getAdminChatIds` шлют **админам**. Куратор получает только in-app `notifications_log`. Нужен helper `curatorChatIdForStudent(studentId)` (student.curator_id → telegram_chat_id).
5. **Миграции:** сегодня 2026-06-22 → имя ПОЗЖЕ `20260621210000` (последняя применённая), формат `20260622HHMMSS_v3_*.sql`. `ADD COLUMN IF NOT EXISTS`. **`ADD CONSTRAINT` НЕ имеет `IF NOT EXISTS`** → `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`. RLS на каждой новой таблице. После колонок/RPC — **регенерить types.ts + `tsc --noEmit`** (иначе Vercel молча билдит старый код — memory `feedback_regen_types_after_migration`).
6. **`role_change_log`** колонки: `changed_user_id, old_role, new_role, changed_by(uuid NN), reason, created_at`. `changed_by = session.uid`.
7. **Деплой = push `main`.** Gate: `tsc --noEmit` + `npx next build` (в Next 16 нет `next lint`; eslint v8 конфиг сломан — не блокер). Поллить прод по статусу роута.

---

## 4. Спеки больших фич (дистиллят; полные — docs/feature-specs/2026-06-backlog-specs.json)

### 5+6. Curator panel (scoped) + уведомления куратору — `curator-panel` (L)
- **Auth:** `AdminRole += 'curator'` в `lib/admin/session.ts` (формат токена не меняется). Снять блок куратора: бот `/panel` (`webhook/route.ts:~1228`), `panel/auth/telegram/route.ts:~39`.
- **Scoping (в КОДЕ):** `panel/students`, `panel/student/[id]` (чужой→404), `stats-data.ts` (фильтр `curator_id===session.uid`). 403 куратору на: `actions/role|transfer|delete|attach`, `requests`, `cities`, `curators`.
- **Уведомления:** таблица-идемпотентность `curator_notify_state(student_id, event_type, event_key, UNIQUE(...))`. События: registered/first_entry/course_started/day_closed/block_completed. day_closed/block_completed — детект recompute-and-compare внутри submit-роутов, дедуп через таблицу; каждый пуш → `notifications_log`.
- **Критика:** не копировать day-логику из block-status (4 today-флага, UTC расходится с RPC); куратор никогда не owner.

### 7+8. Простой >3д + настройки — `inactivity-and-settings` (M)
- **Таблица** `curator_notification_settings(curator_id PK, notify_* bool DEFAULT true, inactivity_threshold_days int DEFAULT 3, digest 'immediate'|'daily'|'off')`.
- **Cron** (Бали) по каждому куратору ищет его учеников без активности > threshold, дедуп через `notifications_log` (тип `silence_3days` уже есть).
- **Критика (ship-blocker):** часть `notify_*` не соответствует существующему коду (curator-Telegram-сендов нет — п.4 разд.3); `last_active_date` в UTC, не Бали — считать `inactiveDays` согласованно. Сначала канал «куратору в бот», потом настройки.

### 9+10. Фокус + отчёты — `focus-and-reports` (L)
- **Таблица** `curator_student_focus(curator_id, student_id, note≤500, created_at, created_by)`. Звезда-тоггл; фокусные вверх + приоритет в уведомлениях.
- **Отчёты:** расширить `GenerateReport` до выбора учеников. Админ — все, куратор — свои (scoping в коде). На ученика: блоки, закрытые дни, активность.
- **Критика:** учитывать UTC-день-модель; 4 источника (не квиз). Зависит от `curator-panel` (впуск куратора).

### 11+12. Часовые пояса + day-gate — `timezone-daygate` (L)
- **Миграция:** `profiles.timezone TEXT NOT NULL DEFAULT 'Asia/Makassar'` (single source), бэкфилл из `cities.timezone`.
- **Логика:** UTC-штамповку → `localToday(tz)` (Intl) в insert-роутах и RPC; при первом полном выполнении 4 требований дня — событие → в 00:00 локали открыть след. день + пуш «день засчитан, завтра продолжаем». Дедуп — partial unique index / insert-then-send.
- **Критика (revise!):** живой `is_block_unlocked` = closed-day «≥7 дней» (не недельный календарь). Ретро-перекладка прошлых дней по новому поясу СЛОМАЕТ прошлые closed-days (cross/prayer в DATE-UTC, recitation/location в TIMESTAMPTZ) → forward-only либо консистентный пересчёт. Без города → дефолт Бали. Сохранить `effective_date` (тест-ускорение).

### 13+14. Богатый + публичный профиль — `rich-profile` (M)
- **Миграции:** `profiles += occupation(≤160), bio(≤1000), testimony, links`; таблица `profile_media`. Constraints через DO/EXCEPTION (idempotent!).
- **UI:** редактирование в `/m/profile`; **публичный** `/m/u/[id]` (клик из трекинга) с постами пользователя (`community_posts` по `author_id`). Storage — `avatars`(public)/`community-media`(signed). XSS — React auto-escape. В `/m/*` нет supabase-сессии → service-role + initData.
- **Критика (blockers):** `ADD CONSTRAINT` не идемпотентен (DO/EXCEPTION); `profile_media.kind` = `PostKind('text','audio','video_note','photo')` иначе PostCard не отрендерит.

### 15. Розовая тема — `pink-theme` (M)
- Тема-движок есть (`ThemeProvider`, `data-theme`, `lib/telegram/theme.ts`, ~17 CSS на `--accent-solid/--accent-gradient`). Добавить `'pink'` в union + override 2 accent-vars + розовые поверхности под `[data-theme="pink"]` (новый `app/m/theme-pink.css`).
- **Миграция:** `profiles += gender, theme_pref` (DO/EXCEPTION CHECK; имя `20260622...`). Приоритет: `theme_pref` > localStorage > gender-дефолт > light. НЕ в FAB-цикл; выбор pink — строкой в профиле.
- **Вопрос Михаилу:** auto-по-gender или ручной? Сбор `gender` — только опционально, «оформление», не геймить логику курса. UI-бриф «светлый-первый» → подтвердить отклонение.

### 16. Производительность — `performance` (M)
- **БД:** `closed_dates_all`/`passed_blocks_all` сканируют все таблицы по ВСЕМ юзерам на каждый вызов. Добавить `*_filtered(p_user_ids uuid[])` + покрывающие индексы. **Критика:** живые тела RPC = 4 источника; не дублировать существующие индексы; `m/tracking` грузит ВСЕХ глобально (не scoped).
- **MiniApp:** дашборд = 2 последовательных запроса + `getWorkedDates` = 8 последовательных. Слить в один серверный вызов + `Promise.all`.
- **Бандл/картинки:** `next/image` не используется (сырой `<img>`); world-atlas (~100КБ) статически в onboarding. `images.remotePatterns`, lazy+dimensions, dynamic-import topojson; `cache()` для `getPanelSession/countPendingRequests`.

---

## 5. Как продолжать (методология)

- **Spec-First.** Скиллы: `/feature-spec`, `/implement-feature`, `/create-migration`, `/run-migration`, `/run-qa-review`, `/deploy`, `/handoff`.
- **Multi-agent поток (как сегодня).** Сохранённый дизайн-workflow: `~/.claude/projects/.../workflows/scripts/krest-feature-specs-wf_c3cb9150-fbb.js` (перезапуск `Workflow({scriptPath})`). Паттерн ревью: dimensions → find → **adversarially verify** каждую находку (default false-positive) → фиксить подтверждённое. Поймало реальные баги (RLS, гонки, escaping, day-модель).
- **Субагенты:** database-architect, backend-engineer, frontend-developer, content-manager, qa-reviewer, agent-architect.
- **Деплой:** `tsc --noEmit` → `npx next build` → push `main` → поллить. Миграции — файл в `supabase/migrations/` + применить (MCP) + регенерить types.
- **Рекоменд. порядок:** `curator-panel` (фундамент #6/#9/#10 + канал «куратору в бот») → `inactivity-and-settings` → `rich-profile`+`/m/u/[id]` (#13/#14) → `pink-theme` (изолированно) → `performance` (индексы безопасны) → `timezone-daygate` (самый рискованный, трогает day-модель и прошлые closed-days).

## 6. Решения Михаила (2026-06-22) — locked
- **Розовая тема — АВТО по полу.** `gender='female'` → авто-применяем pink (theme_pref всё равно перекрывает, если ученица сменит вручную). Сбор `gender` — ок (опционально, как «оформление»). → реализуется в `pink-theme`.
- **Лидерборд трекинга оставляем ГЛОБАЛЬНЫМ** (все ученики). Никаких изменений видимости трекинга не нужно.
- **Day-gate по поясу — только ВПЕРЁД (forward-only).** Прошлые closed-days НЕ переносим/не пересчитываем; новый пояс действует с момента включения. Снимает главный риск `timezone-daygate`.
- 20:00 напоминание сейчас по Бали; перевод на локаль ученика — в рамках `timezone-daygate` (forward-only там же).

---
*Сессия 2026-06-22. Полные спеки+критика: docs/feature-specs/2026-06-backlog-specs.json. Источники истины: SPEC.md, UI_UX_BRIEF.md, CLAUDE.md, memory/MEMORY.md.*
