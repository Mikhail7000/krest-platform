# HANDOVER — КРЕСТ
> Дата: 2026-04-27 11:00 UTC | Сессия: Spec-First + cron + B2B + Telegram-only auth + in-app content editor

---

## 🎯 Что сейчас работает в production

**URL:** `https://krest-platform-web.vercel.app/`

### Реально протестированные сценарии

✅ **Регистрация студента** — через @cross_bot → Mini App → автоматический Telegram-auth (1 клик, без email/пароля). Друг тестировщика прошёл регистрацию, прошёл блок 1, получил одобрение от admin.
✅ **Админ-вход** — chat_id 255214568 → автоматическая роль 'admin' в profile → редирект на `/miniapp/admin.html`
✅ **Telegram webhook** — /start показывает кнопку "✝️ Открыть КРЕСТ" с web_app URL
✅ **Streak-механика** — пишет в `streak_logs`, обновляет `profiles.streak_count`
✅ **Отклонение блока с комментарием** — студент получает push, прогресс сбрасывается
✅ **Cohort auto-join** — студент при входе в блок попадает в малую группу до 12 человек
✅ **Лендинг** для пасторов на `/` + `/register-church`
✅ **Cron** — `/api/cron/reset-streaks`, `/api/cron/archive-cohorts` (требуют `CRON_SECRET` в Vercel — пока не установлен)

### Новое в этой сессии (27.04, после Plan B)

🆕 **In-app редактор блоков** — третья вкладка "Контент" в `/miniapp/admin.html`. Список 6 блоков → клик → модалка с всеми полями (title RU+EN, subtitle, описание, YouTube URL RU+EN, HTML контент, цвет) → save → UPDATE blocks через RLS.
🆕 **Telegram-only регистрация** — убрана email-форма из Mini App. Единственный путь — `/api/miniapp/telegram-auth` с HMAC-валидацией.
🆕 **Auto-confirm email** — `mailer_autoconfirm: true` в Supabase config. Resend rate limit обойдён.
🆕 **Whitelist админов** — `ADMIN_TELEGRAM_CHAT_IDS` env (default: `255214568`). При регистрации через TG автоматически назначается role='admin'.
🆕 **tg.close() при logout** — выход из Mini App вместо редиректа (иначе автологин циклил).

---

## База данных (Supabase)

**Project ref:** `aejhlmoydnhgedgfndql` | **14 таблиц** | **14 миграций применено**

**Auth конфиг (через Supabase Management API):**
- `mailer_autoconfirm: true` — без email-подтверждения
- Триггер `handle_new_user` создаёт profile при INSERT в `auth.users`

**Whitelist админов:** chat_id 255214568 (Михаил)

---

## API Routes (Next.js)

### Auth
- `POST /api/miniapp/telegram-auth` — HMAC-validated Telegram WebApp auth, создаёт user + session
- `POST /api/admin/church/register` — B2B регистрация церкви

### Mini App
- `POST /api/miniapp/notify` — push лидеру при отправке форума
- `POST /api/miniapp/notify-rejection` — push студенту при отклонении блока
- `POST /api/miniapp/notify-registration` — push админам о новом студенте
- `POST /api/miniapp/streak` — Streak механика
- `POST /api/miniapp/cohort` — Auto-cohort малых групп

### Admin
- `POST /api/admin/approve` — одобрение блока
- `POST /api/admin/cohort/setup-telegram` — привязка Telegram-чата к cohort
- `POST /api/student/journal` — сохранение форума
- `POST /api/telegram/webhook` — Telegram bot webhook (с inline кнопкой "✝️ Открыть КРЕСТ")
- `POST /api/auth/logout`

### Cron (`Bearer ${CRON_SECRET}` если установлен)
- `GET /api/cron/reset-streaks` — daily 00:00 UTC
- `GET /api/cron/archive-cohorts` — daily 01:00 UTC

---

## Команда субагентов (актуальна)

| Агент | Модель | Зона |
|-------|--------|------|
| `database-architect` | Opus | Schema, миграции, RLS |
| `backend-engineer` | Sonnet | Next.js API routes |
| `frontend-developer` | Sonnet | Vanilla miniapp + Next.js admin |
| `content-manager` | Sonnet | Контент 6 блоков |
| `qa-reviewer` | Sonnet (без Write) | Проверка |
| `agent-architect` | Opus | Координация |

## Скиллы (10)

`/add-new-block`, `/run-migration`, `/run-qa-review`, `/create-migration`, `/implement-feature`, `/supabase`, `/supabase-postgres-best-practices`, `/deploy`, `/handoff`, `/feature-spec`

---

## Структура

```
/  (9 MD: CLAUDE, PROJECT_IDEA, SPEC, UI_UX_BRIEF, SPEC_TEMPLATE, CREST, METHODOLOGY, START_HERE, HANDOVER)
├── apps/web/
│   ├── public/miniapp/              # Vanilla Mini App: index, lesson, admin, profile, trainer, setup
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/                 # 13 routes (см. выше)
│   │   │   ├── (admin)/admin/, student/, login/, register-church/
│   │   │   └── page.tsx             # Публичный лендинг
│   │   ├── lib/, hooks/, middleware.ts
│   │   └── vercel.json              # Cron schedule
│   └── package.json
├── supabase/migrations/             # 14 миграций
├── .claude/{agents,rules,skills}/
└── docs/{spec-first,course-toolkit,legacy,research}/
```

---

## Активные аккаунты

| Роль | Email | Где креды |
|------|-------|-----------|
| Постоянный admin | sleezard@gmail.com | memory/admin_credentials.md |
| Telegram bot | @cross_bot | env: TELEGRAM_BOT_TOKEN |
| Webhook | https://krest-platform-web.vercel.app/api/telegram/webhook | settled |

---

## Что осталось (для следующих сессий)

### Высокий приоритет
1. **Реалистичный лендинг** — текущий `/` готов, но нужен реальный контент с фото/видео/отзывами
2. **CRON_SECRET в Vercel** — сейчас cron открыт публично

### Средний (post-MVP)
3. Email digest для лидера через Resend (weekly summary активности)
4. UI пастора `/admin/cohorts` в Next.js (управление малыми группами)
5. Конструктор уроков (lessons внутри блоков), сейчас редактируется только верхний уровень `blocks`

### Низкий (post-валидация)
6. ЮKassa подписки
7. AI-ассистент лидера
8. Path of Salvation — следующий курс

---

## 🚧 ПРИОРИТЕТ СЛЕДУЮЩЕЙ СЕССИИ

Михаил планирует **переосмыслить контент** платформы:
- Архитектура остаётся (Telegram Mini App + Supabase + 6 блоков)
- Контент будет другой — будет загружать материалы для пересборки
- Возможна модернизация UI/UX блоков под новый контент

**План:** дождаться материалов от Михаила → проанализировать → предложить структуру контента → обновить через in-app редактор или миграцию `content.sql`.

---

## Контекст принятых решений

- **Двойная архитектура (Next.js + Vanilla)** — Telegram WebView плохо работает с Next.js SSR
- **mailer_autoconfirm=true** — обход Resend rate limit
- **Telegram-only auth** — единственный путь регистрации, без email/пароля
- **Whitelist админов** — chat_id-based, без email-логики
- **Streak Catch Me Up при 2-7 дней пропуска** — Bible.com style
- **Auto-cohort до 12 человек** — Alpha Course style
- **B2B-монетизация только** — студентам всегда бесплатно
- **`SUPABASE_SERVICE_ROLE_KEY` в Vercel = publishable key** (баг env), не настоящий JWT — поэтому используем anon flow + mailer_autoconfirm

---

## Что прочитать первым в новой сессии

1. **`HANDOVER.md`** (этот файл)
2. **`CLAUDE.md`** (всегда автоматически)
3. **`memory/MEMORY.md`** — индекс памяти

Команды быстрого старта:
```bash
git status && git log --oneline -10
mcp__supabase__list_migrations
```

---

*Версия 4.0 | 2026-04-27 11:00 UTC | После in-app content editor + Telegram-only auth*
