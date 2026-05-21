# HANDOVER — КРЕСТ
> Дата: 2026-05-21 | Сессия: 🔨 **Тестовая фаза с Telegram whitelist. English Placeholder UI готов. Приоритет: Curator Dashboard → Alerts System → Design Skill. Начинаем с PoC для демо Алексу Манье.**

---

## 🎯 Главное (читать первым)

1. **Ветка main = e38f394** (последний коммит). Production deployment на Vercel активен.
2. **MiniApp доступен**: `https://krest-platform-web.vercel.app/m/dashboard` через Menu Button бота **`@cross_notify_bot`** (username — по нему ищется).
3. **Тестовая фаза**: только Telegram usernames в `testing_whitelist` таблице получают доступ. Первый тестовый ученик = @Rogue02 (Михаил).
4. **English Placeholder готов**: `/m/onboarding` роутирует язык → страна (TODO) → город (TODO) → куратор (TODO). На English выбор → "Still Cooking" с рандомным NIV стихом из БД.
5. **В БД (`aejhlmoydnhgedgfndql`)**: две новые таблицы — `placeholder_bible_verses` (20 куриалось NIV стихов) и `testing_whitelist` (Telegram usernames). Types регенерированы.
6. **Михаил (sleezard@gmail.com)**: UUID `281ddca3-c413-43e3-bbb1-02bd60d6d2f7`, super_admin, is_protected=TRUE, telegram_chat_id=255214568, в whitelist.

---

## ✅ Что работает в production

- Menu Button бота `@cross_notify_bot` открывает MiniApp на `/m/dashboard`
- `TelegramProvider` валидирует initData по HMAC + auth_date ≤ 8h
- **Whitelist checking** в `/api/miniapp/telegram-auth` — если username не в `testing_whitelist` → 403 Access Denied
- `resolveUserId` находит профиль Михаила, пропускает (whitelist + super_admin)
- Все API endpoints `/api/m/*` работают со service_role ключом, RLS не мешает
- Страницы блоков рендерятся: видео + конспект + квиз + местописания + пересказ + фото
- Экзамены mid/final + экран «Мастер Креста» доступны (Михаил проходил end-to-end на локали, прогресс в БД сохранён)
- **English Placeholder** (`/m/onboarding`): язык → рандомный NIV стих из `placeholder_bible_verses`, фреймер-анимации, back-кнопка
- Maintenance gate `/m/*` пропускает (middleware whitelist), статичные пути закрыты bypass-token-ом
- Cron-задачи `reset-streaks`, `archive-cohorts` — legacy v2.0, висят но не мешают

## 🔄 Что в процессе

- **English Placeholder**: UI компоненты готовы (LanguageSelect, EnglishPlaceholder, page.tsx), тестирование на локали/Vercel.
- **Curator Dashboard**: дизайн; студенты по списку; прогресс блоков; notifications queue.
- **Support system**: Диалог «Напишите в поддержку» → super_admin может видеть и отвечать.

## ❌ Что сломано / технические долги

- **Хардкод `@cross_bot` в [TelegramProvider.tsx](apps/web/src/components/telegram/TelegramProvider.tsx#L59,L85)** — должно быть `@cross_notify_bot` (это username бота, по нему ищут в Telegram). Сейчас ученик может прочитать «откройте @cross_bot» и не найти.
- **Support message system** — уведомления о попытке доступа при ACCESS_DENIED вывести не где (диалог нужен в UI). TODO.
- **Russian onboarding flow** — `/m/onboarding` для Русского: выбор страны → города → куратора (пока только заглушка).
- **Curator Dashboard UI** — не доделан. Нужны: список студентов, прогресс каждого, notifications queue, экран экзаменов.
- **Alerts system** — не реализован (24h silence alerts, тишина 3+ дня, успешные экзамены).
- **`apps/web/package.json` script `lint`** — всё ещё на `next lint` (Next 16 удалил). Не блокер.
- **Унаследованные WARN advisors** (~16 шт): `function_search_path_mutable` + `anon/authenticated_security_definer_function_executable`. Не критично.
- **Legacy v2.0 cron-endpoints**: `/api/cron/reset-streaks`, `/api/cron/archive-cohorts`. Удалить при чистке legacy.

---

## 🆕 Главные решения этой сессии (2026-05-21)

| Решение | Почему | Где смотреть |
|---|---|---|
| Whitelist-based access control | Ограничить доступ только Telegram usernames в `testing_whitelist` до полного одобрения демо | `/api/miniapp/telegram-auth` строки 76-105, таблица `testing_whitelist` |
| Таблица `placeholder_bible_verses` | Полный контроль над контентом, нет зависимостей от GitHub, 20 куриалось NIV стихов | миграция `placeholder_bible_verses.sql` |
| English Placeholder UI (`/m/onboarding/*`) | PoC для демо: язык → English → "Still Cooking" → рандомный стих | `page.tsx`, `LanguageSelect.tsx`, `EnglishPlaceholder.tsx` |
| Таблица `testing_whitelist` с Telegram username | Управление доступом по username (не email) для тестирования | новая таблица, RLS, trigger для `is_whitelisted` |
| Regenerate types.ts | TypeScript strict requires новые типы для таблиц | `mcp__supabase__generate_typescript_types` |
| Приоритизация: English → Dashboard → Alerts | Демо in order: язык → куратор видит студентов → уведомления | `project_priority_demo_first.md` |

---

## 📂 Коммиты этой сессии (2026-05-21)

**Ветка**: main @ e38f394

**Новые файлы (к коммиту):**
```
feat(onboarding): add language selection with English placeholder
- apps/web/src/app/m/onboarding/page.tsx
- apps/web/src/app/m/onboarding/LanguageSelect.tsx
- apps/web/src/app/m/onboarding/EnglishPlaceholder.tsx
- apps/web/src/components/ui/EnglishPlaceholder.tsx (если перемещать в features/)
```

**Обновлённые файлы:**
```
feat(telegram-auth): add whitelist checking via testing_whitelist table
- apps/web/src/app/api/miniapp/telegram-auth/route.ts (lines 76-105)

chore(types): regenerate types.ts after new migrations
- packages/supabase/src/types.ts (new tables: placeholder_bible_verses, testing_whitelist)
```

**Миграции БД (применены через MCP `apply_migration`):**
```
-- v3_placeholder_bible_verses.sql — 20 NIV стихов
-- v3_testing_whitelist.sql — управление тестовыми username
```

---

## 🛤 TODO следующей сессии (приоритеты для демо Алексу Манье)

### ✅ Завершено в этой сессии

- ✅ Whitelist access control (Telegram username)
- ✅ English Placeholder UI (LanguageSelect, EnglishPlaceholder, page.tsx)
- ✅ Таблицы БД (placeholder_bible_verses, testing_whitelist)
- ✅ Types regenerated

### 🔴 Критичные (Блокирующие демо)

1. **Commit & deploy English Placeholder** → проверить на Vercel `/m/onboarding`
2. **Curator Dashboard** (список студентов со статусом блоков) — в `/admin/dashboard` или `/m/curator/dashboard`
3. **Alerts system** (уведомления куратору: новые сабмишены, тишина, экзамены)
4. **Support message system** — Диалог «Напишите в поддержку» в error state → super_admin видит + может отвечать

### 🟡 Важно (до запуска с реальными учениками)

5. **Заменить хардкод `@cross_bot` на `@cross_notify_bot`** в `apps/web/src/components/telegram/TelegramProvider.tsx` строки 59 и 85
6. **Russian onboarding flow** — страна → город → куратор (из `/m/onboarding` для Русского выбора)
7. **HapticFeedback** на submit квиза/экзамена (`useHaptic` есть, подключить)
8. **BackButton wrapper** на `/m/lesson`, `/m/quiz`, `/m/exam`, `/m/locations`, `/m/recitation`, `/m/cross-photo`
9. **Починить `lint` script** в `apps/web/package.json` — `tsc --noEmit && eslint . --ext .ts,.tsx`

### 🟢 После одобрения демо Алексом Манье

- **OpenRouter миграция** для всех LLM-вызовов (см. `project_ai_providers_plan.md`)
- **Self-hosted Supabase на Beget VPS** для 152-ФЗ (см. `lessons15_18_20_21_for_krest.md`)
- **Custom domain** (`.ru` через Beget/Cloudflare)
- **Сертификат PDF** «Мастер Креста» с tg.downloadFile
- **Админка кураторов** (полный функционал групп)

---

## ⚙️ Технические условия следующей сессии

1. **MCP Supabase** работает. project_ref `aejhlmoydnhgedgfndql`.
2. **Env-переменные** в `apps/web/.env.local` — всё валидно.
3. **Env на Vercel (Production + Preview)** — все переменные проставлены, `SUPABASE_SERVICE_ROLE_KEY` — service_role.
4. **New tables in БД**: `placeholder_bible_verses` (20 NIV стихов), `testing_whitelist` (Telegram usernames).
5. **Types.ts** — регенерирован включает новые таблицы.
6. **Permissions Bash**: `npm install`, `npm run`, `node *` в deny у Claude. Михаил запускает сам.
7. **Безопасность**: не запрашивать полные секреты (только префикс).
8. **No false claims** — различать user message vs tool result.

---

## 📂 Ключевые файлы и пути

**Спеки и rules:**
- `CLAUDE.md` v3.0
- `.claude/rules/church-platform.md` v3.0
- `docs/spec-first/04-ai-first-flow.md` v1.1 — главная спека AI-first потока
- `docs/spec-first/04a-locations-seed.md` v1.0 — 55 эталонных местописаний

**Memory (важные для деплоя/прода):**
- `feedback_supabase_service_role_diagnostic.md` — диагностика «нет данных без ошибки»
- `project_telegram_bots.md` — `@cross_notify_bot` vs `@cross_capsule` (display)
- `lessons15_18_20_21_for_krest.md` — гайд Алекса по MiniApp + 152-ФЗ
- `project_ai_providers_plan.md` — миграция на OpenRouter после демо
- `project_priority_demo_first.md` — приоритет демо книжке
- `feedback_no_false_claims_about_user_actions` — мой урок: различать user message vs tool result

**AI-инфраструктура:**
- `apps/web/src/lib/ai/anthropic.ts`, `whisper.ts`, `deepgram.ts`, `constants.ts`
- `apps/web/src/lib/telegram/init-data.ts`, `resolve-user.ts`, `theme.ts`
- `apps/web/src/lib/supabase-service.ts` — service-role клиент

**Активные аккаунты:**
| Роль | Идентификатор |
|------|---------------|
| super_admin (protected, can_skip_block_lock=TRUE, is_whitelisted=TRUE) | sleezard@gmail.com / chat_id 255214568 / UUID `281ddca3-c413-43e3-bbb1-02bd60d6d2f7` |
| Telegram bot (прод, username) | `@cross_notify_bot` |
| Telegram bot (прод, display name) | `cross_capsule` |
| Telegram bot (тест PoC) | `@Cross_Capsule_Test_bot` |
| Production URL | `https://krest-platform-web.vercel.app/` |
| Supabase project ref | `aejhlmoydnhgedgfndql` |

---

## 🚀 Что сделать в начале новой сессии

1. **Прочитать HANDOVER.md** (этот файл)
2. **Просканировать `memory/MEMORY.md`** — индекс важных решений
3. **Первый шаг**: Commit + push English Placeholder компонентов на Vercel
4. **Второй шаг**: Curator Dashboard (список студентов со статусом прогресса)
5. **Третий шаг**: Alerts System (куратору о новых сабмишенах, молчании, экзаменах)
6. **Проверить** на Vercel `/m/onboarding` → English → "Still Cooking" экран

### Чего НЕ делать

- НЕ нажимать **«Disable legacy API keys»** в Supabase Dashboard — JWT-ключи в работе
- НЕ переименовывать `@cross_notify_bot` (Telegram не позволит)
- НЕ удалять legacy v2.0 таблицы без подтверждения
- НЕ применять OpenRouter — отложено до одобрения демо
- НЕ присылать полные секреты в чат
- НЕ запускать subagents без явной просьбы

---

*Версия 15.0 | 2026-05-21 | Testing phase с Telegram whitelist. English Placeholder готов. Следующая сессия: commit → Curator Dashboard → Alerts System → показ Алексу Манье.*
