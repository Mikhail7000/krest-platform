# HANDOVER — КРЕСТ
> Дата: 2026-04-27 | Сессия: Plan B + post-MVP cron/B2B + auth-fixes + Telegram-auth + лендинг

---

## 🎯 ВАЖНО для следующей сессии

### Регистрация ТЕПЕРЬ работает 3 способами:
1. **Email + пароль** (самый простой) — стандартный signUp с `mailer_autoconfirm=true` (письма не отправляются, лимит Resend не блокирует)
2. **Через Telegram WebApp** (1 клик) — кнопка "✈️ Войти через Telegram" видна только когда страница открыта из бота. Использует `tg.initData` с HMAC-валидацией.
3. **Через ссылку-приглашение церкви** — `?ref=invite_token` автоматически привязывает студента к церкви и пастору

### Что НЕ нужно делать пользователю:
- ❌ Не нужно добавлять `SUPABASE_SERVICE_ROLE_KEY` в Vercel (мы обошли это через mailer_autoconfirm)
- ❌ Не нужно письмо-подтверждение для пользователей (отключено через Management API)

### Что **НУЖНО** сделать пользователю (опционально):
- ⚠️ Добавить `CRON_SECRET` в Vercel для защиты cron-endpoints (сейчас открыты)
- ⚠️ В Supabase Dashboard → Settings → API обновить `SUPABASE_SERVICE_ROLE_KEY` в Vercel env (там сейчас стоит publishable key вместо service_role JWT) — это нужно если в будущем понадобится auth.admin API

---

## Текущий статус

### ✅ Что работает в production

**Лендинг:** `https://krest-platform-web.vercel.app/`
- Hero "Узнай христианство за 6 недель"
- 3 блока "Как это работает" (6 блоков / Лидер / Малая группа)
- Секция для пасторов с CTA "Зарегистрировать церковь"
- Footer с ссылкой на /login

**Telegram Mini App:** `https://krest-platform-web.vercel.app/miniapp/index.html`
- Дашборд с 6 блоками + streak counter (🔥)
- Регистрация: email или Telegram-1-click
- Вход через Telegram (`tg.initData` HMAC-validated)
- Блок-flow: видео + форум (3×100 символов) + одобрение лидера
- Cohort-badge (👥 N человек) на странице урока
- Test mode `?test=1` (2x speed, 5% threshold)

**Веб-админка пастора:** `https://krest-platform-web.vercel.app/login`
- Регистрация церкви на `/register-church`
- После логина → `/admin` (текущий, нужен апдейт)
- `/admin/students` — список студентов

**Cron-задачи (Vercel Scheduled):**
- `/api/cron/reset-streaks` (00:00 UTC) — сброс streak >7 дней
- `/api/cron/archive-cohorts` (01:00 UTC) — архивация cohorts >14 дней

### ✅ Тесты (run on 27.04 от 21:42)

| Тест | Статус |
|------|--------|
| Email signup | ✅ User создан, email_confirmed_at установлен |
| Email duplicate | ✅ 422 |
| Login | ✅ access_token получен, profile через триггер |
| Telegram-auth no body | ✅ 400 BAD_REQUEST |
| Telegram-auth no hash | ✅ 401 INVALID_INIT_DATA |
| Telegram-auth bad HMAC | ✅ 401 INVALID_HMAC |
| Все страницы | ✅ 200 (кроме редиректов / → /, /miniapp/ → /miniapp/index.html) |
| API валидация | ✅ Все возвращают 400 на пустое тело |

---

## База данных (Supabase)

**Project ref:** `aejhlmoydnhgedgfndql`

**Применено миграций:** 14

**Таблицы (14):**
- `profiles` — расширен 25 колонками (telegram_chat_id, church_id, streak_count, etc.)
- `blocks`, `lessons`, `student_progress`, `journal_entries`, `bible_verses`
- `uploads`, `weekly_submissions`
- `streak_logs` — лог дневной активности
- `churches` — B2B-партнёры с invite_token
- `cohorts` + `cohort_members` — малые группы (auto-cohort до 12)
- `block_rejections` — история отклонений с комментариями
- `notifications_log` — лог push/email

### Auth конфиг (через Supabase Management API)
- `mailer_autoconfirm: true` — письма не отправляются, пользователи сразу подтверждены
- `disable_signup: false` — открытая регистрация
- `password_min_length: 6`

---

## API Routes (Next.js)

### Авторизация и регистрация
- `POST /api/miniapp/telegram-auth` 🆕 — Telegram WebApp 1-click auth (HMAC-validated)
- `POST /api/admin/church/register` — регистрация церкви + пастора

### Mini App
- `POST /api/miniapp/notify` — уведомление лидеру при форуме
- `POST /api/miniapp/notify-rejection` — отклонение блока с комментарием
- `POST /api/miniapp/notify-registration` — уведомление admin о новом
- `POST /api/miniapp/streak` — Streak механика
- `POST /api/miniapp/cohort` — Auto-cohort малых групп

### Admin
- `POST /api/admin/approve` — одобрение блока
- `POST /api/admin/cohort/setup-telegram` — привязать Telegram-чат к cohort
- `POST /api/student/journal` — сохранение форума
- `POST /api/telegram/webhook` — Telegram bot webhook
- `POST /api/auth/logout`

### Cron (защищены через `Bearer ${CRON_SECRET}` если установлен)
- `GET /api/cron/reset-streaks` — daily 00:00 UTC
- `GET /api/cron/archive-cohorts` — daily 01:00 UTC

---

## Команда субагентов (все обновлены 27.04)

| Агент | Модель | Зона |
|-------|--------|------|
| `database-architect` | Opus | Supabase schema, миграции, RLS |
| `backend-engineer` 🆕 | Sonnet | Next.js API routes, Server Actions |
| `frontend-developer` | Sonnet | Vanilla miniapp + Next.js admin |
| `content-manager` | Sonnet | 6 блоков, RU/EN |
| `qa-reviewer` | Sonnet (БЕЗ Write) | 8 категорий проверки |
| `agent-architect` | Opus | Координация, деплой |

## Скиллы (10)

`/add-new-block`, `/run-migration`, `/run-qa-review`, `/create-migration`, `/implement-feature`, `/supabase`, `/supabase-postgres-best-practices`, `/deploy` 🆕, `/handoff` 🆕, `/feature-spec` 🆕

---

## Структура проекта

```
/
├── 9 MD-файлов в корне: CLAUDE.md, PROJECT_IDEA.md, SPEC.md, UI_UX_BRIEF.md,
│   SPEC_TEMPLATE.md, CREST.md, METHODOLOGY.md, START_HERE.md, HANDOVER.md
├── apps/web/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/...              # 13 routes
│   │   │   ├── (admin)/admin/, student/, login/, register-church/
│   │   │   └── page.tsx              # 🆕 публичный лендинг
│   │   ├── lib/, hooks/
│   │   └── middleware.ts
│   ├── public/miniapp/               # Vanilla Telegram Mini App
│   ├── vercel.json                   # Cron schedule
│   └── package.json
├── supabase/migrations/              # 14 миграций
├── .claude/
│   ├── agents/                       # 6 агентов
│   ├── rules/                        # 5 правил
│   └── skills/                       # 10 скиллов
└── docs/
    ├── spec-first/                   # 01 + 02 артефакты
    ├── course-toolkit/               # 19 шаблонов курса Алекса
    ├── legacy/, research/
```

---

## Активные аккаунты

| Роль | Email | Где креды |
|------|-------|-----------|
| Постоянный admin | sleezard@gmail.com | memory/admin_credentials.md |
| Telegram bot | @cross_bot | env: TELEGRAM_BOT_TOKEN |

**Studento-тестовик:** не нужен — можно зарегаться через Telegram WebApp в 1 клик или через email на `/miniapp/index.html`.

---

## Vercel env vars (из `/api/debug-env` диагностики ранее)

| Var | Status |
|-----|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ PRESENT |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ PRESENT |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ PRESENT but contains publishable key (sb_publi...), not JWT — нужно обновить если понадобятся auth.admin API |
| `TELEGRAM_BOT_TOKEN` | ✅ PRESENT |
| `RESEND_API_KEY` | ⚠️ Не проверено (Resend упёрся в rate limit, но через mailer_autoconfirm нам не нужен) |
| `CRON_SECRET` | ❌ MISSING — добавить чтобы защитить cron-endpoints |
| `NEXT_PUBLIC_SITE_URL` | (опционально, default krest-platform-web.vercel.app) |

---

## TODO для следующей сессии

### Высокий приоритет
1. **Реальный тест Telegram-auth** — войти в @cross_bot, нажать "Open App", проверить что 1-click регистрация работает
2. **UI пастора `/admin/cohorts`** — список своих cohorts с возможностью привязать Telegram-чат
3. **Обновить `SUPABASE_SERVICE_ROLE_KEY` в Vercel** — взять правильный JWT из Supabase Dashboard → Settings → API

### Средний (post-MVP)
4. Email digest для лидера через Resend (weekly summary активности)
5. UI редактора контента блоков для пастора
6. Полноценная админ-панель `/admin` (сейчас базовая)

### Низкий (post-валидация)
7. ЮKassa подписки (после 5+ платящих церквей)
8. AI-ассистент лидера
9. Path of Salvation — следующий курс после КРЕСТ

---

## Контекст принятых решений

- **Двойная архитектура (Next.js + Vanilla)** — Telegram WebView плохо работает с Next.js SSR
- **mailer_autoconfirm=true** — обход Resend rate limit (100 emails/day free tier). Email теперь не нужен для регистрации
- **Telegram-auth через HMAC** — безопасная 1-click регистрация без email и пароля для пользователей
- **Тех. email `tg{id}@krest.local`** — для Telegram-пользователей создаётся автоматически, никогда не используется как реальный
- **Детерминированный пароль** для Telegram-пользователей — `HMAC(BOT_TOKEN, "tg-pwd-{id}")` — пользователь не вводит, сервер знает как залогинить
- **Streak Catch Me Up при 2-7 дней пропуска** — серия не сбрасывается (Bible.com style)
- **Auto-cohort до 12 человек** — Alpha Course style
- **B2B-монетизация только** — студентам всегда бесплатно
- **Telegram Bot НЕ создаёт группы программно** — это ограничение API. Пастор создаёт сам, привязывает chat_id через `/api/admin/cohort/setup-telegram`
- **Cron через Vercel** — не Edge Functions (запрет в CLAUDE.md)

---

## Что прочитать первым в новой сессии

1. **`HANDOVER.md`** (этот файл)
2. **`CLAUDE.md`** (всегда автоматически)
3. **`SPEC.md`** — если работаем над новой фичей
4. **`memory/MEMORY.md`** — индекс памяти

Команды быстрого старта:
```bash
git status && git log --oneline -10
mcp__supabase__list_migrations
curl -s https://krest-platform-web.vercel.app/api/debug-env  # удалён, см. memory
```

---

*Версия 3.0 | 2026-04-27 21:45 UTC | После Plan B + auth-fixes + Telegram-auth + лендинг*
