# HANDOVER — КРЕСТ
> Дата: 2026-05-17 | Сессия: ✅ **Деплой на production выполнен. MiniApp работает в Telegram через `@cross_notify_bot`** (username — по нему ищется в Telegram; display name = «cross_capsule», но не имеет @ и для поиска не используется). Найдена и устранена ключевая проблема — на Vercel в `SUPABASE_SERVICE_ROLE_KEY` лежал anon-key вместо service_role. После замены MiniApp проходит цикл end-to-end.

---

## 🎯 Главное (читать первым)

1. **Ветка main = 0a0c175 → e38f394** (debug добавлен и убран). Production deployment активен.
2. **MiniApp доступен**: `https://krest-platform-web.vercel.app/m/dashboard` через Menu Button бота **`@cross_notify_bot`** (это username — по нему ищется в Telegram). Display name бота — «cross_capsule» (видно в шапке чата), но `@cross_capsule` НЕ существует, для поиска и в текстах для учеников использовать строго `@cross_notify_bot`.
3. **Михаил протестировал**: открывает MiniApp → видит dashboard со списком блоков → переходит на пересказ/местописания/фото без ошибок.
4. **В БД (`aejhlmoydnhgedgfndql`)**: добавлен UNIQUE constraint `profiles_telegram_chat_id_unique`. Дубликат-профиль «Миша Моряк» удалён. У Михаила (sleezard@gmail.com) — один профиль `281ddca3-c413-43e3-bbb1-02bd60d6d2f7`, super_admin, is_whitelisted=TRUE, is_protected=TRUE, can_skip_block_lock=TRUE.
5. **Все env-переменные на Vercel** проставлены через Import .env, ключи валидны.
6. **`tsc --noEmit` чистый. Production билды Ready.**

---

## ✅ Что работает в production

- Menu Button бота `@cross_capsule` открывает MiniApp на `/m/dashboard`
- `TelegramProvider` валидирует initData по HMAC + auth_date ≤ 8h
- `resolveUserId` находит профиль Михаила, пропускает (whitelist + super_admin)
- Все API endpoints `/api/m/*` работают со service_role ключом, RLS не мешает
- Страницы блоков рендерятся: видео + конспект + квиз + местописания + пересказ + фото
- Экзамены mid/final + экран «Мастер Креста» доступны (Михаил проходил end-to-end на локали, прогресс в БД сохранён)
- Maintenance gate `/m/*` пропускает (middleware whitelist), статичные пути закрыты bypass-token-ом
- Cron-задачи `reset-streaks`, `archive-cohorts` — legacy v2.0, висят но не мешают

## 🔄 Что в процессе

Ничего открытого. Сессия закрыта.

## ❌ Что сломано / технические долги

- **Хардкод `@cross_bot` в [TelegramProvider.tsx](apps/web/src/components/telegram/TelegramProvider.tsx#L59,L85)** — должно быть `@cross_notify_bot` (это username бота, по нему ищут в Telegram). Сейчас ученик может прочитать «откройте @cross_bot» и не найти.
- **`apps/web/package.json` script `lint`** всё ещё на `next lint` (Next 16 удалил). Не блокер.
- **Унаследованные WARN advisors** (~16 шт): `function_search_path_mutable` + `anon/authenticated_security_definer_function_executable` для функций `is_admin`, `is_visible_to`, `get_leader_chat_id`. Не критично.
- **Legacy v2.0 cron-endpoints**: `/api/cron/reset-streaks`, `/api/cron/archive-cohorts` в `apps/web/vercel.json` — таблицы пустые, операции no-op. Удалить при чистке legacy.

---

## 🆕 Главные решения этой сессии (2026-05-17)

| Решение | Почему | Где смотреть |
|---|---|---|
| Merge `feat/nextjs-miniapp-poc` в `main` | Production на Vercel билдится с main, без merge AI-first MVP не доезжал | коммит `66ddab2` |
| `SUPABASE_SERVICE_ROLE_KEY` починен на Vercel (anon → service_role) | RLS на profiles резала `auth.uid()=null` → 0 строк без ошибки → ложный PROFILE_NOT_FOUND. Час диагностики | memory `feedback_supabase_service_role_diagnostic.md` |
| `UNIQUE` constraint на `profiles.telegram_chat_id` | После удаления дубликата «Миша Моряк». Один Telegram user.id = один профиль | миграция `..._profiles_telegram_chat_id_unique.sql` |
| Display name бота → `cross_capsule` (без @) | Михаил поменял через `/setname` в BotFather. Username `@cross_notify_bot` остался — username поменять нельзя без `_bot` суффикса. Для учеников и в коде использовать только `@cross_notify_bot` | memory `project_telegram_bots.md` |
| Удалить дубликат-профиль «Миша Моряк» | Два профиля с одним telegram_chat_id → `.maybeSingle()` возвращал null → PROFILE_NOT_FOUND | manual SQL DELETE |
| Импорт env на Vercel через `Import .env` файла `apps/web/.env.vercel-prod.local` | Удобнее ручного ввода 15 переменных | файл в .gitignore |

---

## 📂 Коммиты этой сессии

```
e38f394 chore(telegram): убрать temp debug-logging из resolveUserId
0a0c175 debug(telegram): temp logging in resolveUserId to diagnose PROFILE_NOT_FOUND
66ddab2 merge: AI-first MVP v3 → production
118ee5a docs: HANDOVER v13.0 — AI-first MVP собран, готов к деплою (из прошлой сессии)
```

Плюс одна миграция БД, применённая через MCP: `v3_profiles_telegram_chat_id_unique`.

---

## 🛤 TODO следующей сессии (приоритеты)

### Малые правки (1-2 часа)

1. **Заменить хардкод `@cross_bot` на `@cross_notify_bot`** в `apps/web/src/components/telegram/TelegramProvider.tsx` строки 59 и 85. Это **username**, по нему ищется бот в Telegram. `cross_capsule` — это display name (заголовок в шапке), а не username, использовать его в текстах для учеников НЕЛЬЗЯ.
2. **HapticFeedback** на submit квиза/экзамена/местописаний (`useHaptic` уже есть, только подключить).
3. **BackButton wrapper** на `/m/lesson`, `/m/quiz`, `/m/exam`, `/m/locations`, `/m/recitation`, `/m/cross-photo`. Скрывать на dashboard.
4. **Починить `lint` script** в `apps/web/package.json` — заменить `next lint` на `tsc --noEmit && eslint . --ext .ts,.tsx`.

### Расширение whitelist для тестов

5. Когда Михаил подведёт книжку (Александр Алферев) и 2-3 тестовых ученика:
   - Они ищут бота по username **`@cross_notify_bot`**, отправляют `/start` → попадают в `profiles` (через webhook, если будет настроен; иначе вручную через SQL)
   - Получают свой chat_id через `@userinfobot`
   - SQL через MCP: `UPDATE profiles SET is_whitelisted=TRUE WHERE telegram_chat_id=<N>;`

### Когда демо одобрено

6. **OpenRouter** для всех LLM-вызовов. См. `project_ai_providers_plan.md`.
7. **Self-hosted Supabase на Beget VPS** для 152-ФЗ. См. `lessons15_18_20_21_for_krest.md` (Урок 21).
8. **Custom domain** через Beget (`.ru`) или Cloudflare Registrar.

### Параллельно (когда удобно)

| Задача | Когда |
|---|---|
| Сертификат PDF «Мастер Креста» с tg.downloadFile | После запуска книжке |
| Direct-to-Storage signed URL для recitation > 4 MB | Если ученик запишет аудио длиннее 10 мин |
| Почистить унаследованные advisors WARN | Перед запуском с массовыми учениками |
| Удалить legacy v2.0 cron-endpoints + сами таблицы (cohorts, weekly_submissions, journal_entries, bible_verses) | После запуска, когда не страшно |
| Тренажёр местописаний (Quizlet-стиль) | Запросит Михаил позже |
| Админка кураторов | После одобрения демо |

---

## ⚙️ Технические условия следующей сессии

1. **MCP Supabase** работает. project_ref `aejhlmoydnhgedgfndql`.
2. **Env-переменные** в `apps/web/.env.local` — всё валидно.
3. **Env на Vercel (Production + Preview)** — все 15 переменных проставлены, `SUPABASE_SERVICE_ROLE_KEY` — service_role (JWT legacy).
4. **Permissions Bash**: `npm install`, `npm run`, `node *` в deny у Claude. Михаил запускает скрипты сам.
5. **Безопасность**: не запрашивать у Михаила полные секреты (только префикс с маркой «остальное замазал»).
6. **`feedback_no_false_claims_about_user_actions`** — различать user message vs tool result, не приписывать действия.

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

1. Прочитать этот HANDOVER.md
2. Просканировать индекс `memory/MEMORY.md`
3. Кратко отчитаться: где мы, что в TODO
4. Спросить Михаила: с чего начнём — мелкие правки (хардкод/haptic/back-button) или ждём фидбэк от книжки?

### Чего НЕ делать

- НЕ нажимать **«Disable legacy API keys»** в Supabase Dashboard — legacy JWT-ключи всё ещё в работе
- НЕ переименовывать `@cross_notify_bot` без `_bot` суффикса (Telegram не позволит)
- НЕ удалять legacy v2.0 таблицы и cron без подтверждения Михаила
- НЕ применять миграцию OpenRouter — отложено до явного «демо одобрено»
- НЕ присылать секреты в чат
- НЕ запускать subagents без явной просьбы Михаила

---

*Версия 14.0 | 2026-05-17 | Production live. MiniApp в Telegram работает end-to-end. Следующая сессия — мелкие UX-полировки и подготовка к показу книжке.*
