# Session Handoff — КРЕСТ
> Дата: 2026-04-24 | Сессия: Документация + Миграция на Next.js

---

## Статус платформы

- ✅ Vanilla JS версия работает локально (localhost:5500)
- ✅ Supabase подключён (проект: aejhlmoydnhgedgfndql)
- ✅ MCP серверы: Context7, Supabase, GitHub — все Connected
- ✅ Telegram бот @cross_notify_bot создан, уведомления работают
- ✅ Миграции применены: admin_approved, blocks_unlocked, telegram_chat_id
- ⏳ Vercel деплой — не сделан (сознательно отложен)
- ⏳ Telegram student binding — UI не создан

---

## Завершено в этой сессии

### Документация (создано с нуля)
- `START_HERE.md` — навигатор по проекту для новой сессии
- `METHODOLOGY.md` — методология разработки, правила работы с субагентами
- `docs/LESSON_FLOW.md` — 7-шаговый flow урока с кодом
- `docs/SUPABASE_SCHEMA.md` — схема всех 7 таблиц + RLS + быстрые запросы
- `docs/VIDEO_PROTECTION.md` — YouTube no-skip полная реализация
- `docs/TELEGRAM_BOT.md` — архитектура уведомлений
- `docs/MINIAPP_ARCHITECTURE.md` — Telegram Mini App архитектура (Agent-Architect)
- `docs/GETCOURSE_INTEGRATION.md` — GetCourse вебхук flow (Agent-Architect)
- `docs/SUPPORT_BOT.md` — команды бота /start /status /myblock (Agent-Architect)

### Seed Data структура
- `seed-data/blocks/` — 6 MD-файлов с контентом блоков КРЕСТ (RU + EN)
- `seed-data/verses/` — 6 файлов со стихами (~30 стихов для тренажёра)
- `scripts/populate-content.mjs` — скрипт наполнения Supabase из MD-файлов
- `COURSE_STRUCTURE.md` — структура курса КРЕСТ
- `COURSE_ASSETS.md` — реестр медиа-ассетов

### Архитектурное решение
**Принято решение мигрировать с Vanilla JS на TypeScript/Next.js** — чтобы соответствовать стеку Алекса и требованиям команды.

---

## Проблемы и решения этой сессии

| Проблема | Решение |
|----------|---------|
| docs/ файлы не совпадали со структурой Алекса | Созданы MINIAPP, GETCOURSE, SUPPORT_BOT через Agent-Architect |
| Стек Vanilla не соответствует стеку Алекса (TypeScript) | Решено: мигрируем на Next.js 15 + TypeScript + Turborepo |
| Не было seed-data структуры | Создана полная структура + populate-content.mjs |

---

## Что НЕ трогать

- `js/config.js` — там живые Supabase ключи и Telegram токен
- `supabase/schema.sql` и `supabase/content.sql` — источники истины по БД
- `supabase/migrations/` — применённые миграции
- `.mcp.json` — конфигурация MCP серверов

---

## Следующие шаги

### 🔴 Приоритет 1: Фаза 0 миграции (ТЕКУЩАЯ ЗАДАЧА)
1. `git init` в корне проекта
2. Первый коммит с текущим Vanilla кодом
3. Создать ветку `legacy-vanilla` (заморозить Vanilla)
4. Создать Turborepo monorepo структуру:
   - `apps/web/` — Next.js 15 + TypeScript
   - `packages/supabase/` — типы и клиент
5. Настроить Vercel под Next.js (Root Directory: apps/web)
6. Настроить ENV переменные в Vercel

### ⏳ Приоритет 2: Фаза 1 — packages/supabase
- TypeScript типы из Supabase gen types
- Browser client + Server client

### ⏳ Приоритет 3: Остальные фазы (2-8)
- Auth + Middleware (Фаза 2)
- YouTube no-skip хук (Фаза 3)
- Страницы студента (Фаза 4)
- Страницы лидера (Фаза 5)
- API Routes: вебхуки (Фаза 6)
- Telegram Mini App (Фаза 7)
- QA + переключение (Фаза 8)

---

## Как начать следующую сессию

1. Прочитать `handoff.md` (этот файл)
2. Прочитать `METHODOLOGY.md` — правила субагентов
3. Проверить `claude mcp list` — все 3 сервера Connected
4. Продолжить с той фазы миграции где остановились

---

## Ключевые файлы для миграции

- `student/lesson.html` — источник истины для 7-шагового flow (Фаза 3-4)
- `js/auth.js` — requireAuth, toast, sendTelegramMsg → в React хуки
- `js/config.js` — Supabase keys, i18n → в ENV + lib/i18n.ts
- `docs/SUPABASE_SCHEMA.md` — для генерации TypeScript типов
- `supabase/schema.sql` — полная схема БД

---

## ENV переменные (нужны для Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://aejhlmoydnhgedgfndql.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[из config.js]
SUPABASE_SERVICE_ROLE_KEY=[из Supabase Dashboard]
TELEGRAM_BOT_TOKEN=8348590676:AAFc2U8sAZTEAHq_xFFbi0cQEoTeugDkx70
TELEGRAM_LEADER_CHAT_ID=255214568
NEXT_PUBLIC_APP_URL=https://krest.vercel.app
```
