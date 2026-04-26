# HANDOVER — КРЕСТ
> Дата: 2026-04-27 | Завершён План B + средний приоритет + cron + B2B onboarding

---

## Текущий статус

✅ **Что работает (production):**
- Telegram Mini App `https://krest-platform-web.vercel.app/miniapp/`
- Регистрация студента + email-подтверждение через Resend
- 6 блоков с no-skip видео + форум (3 вопроса × 100 символов)
- Одобрение блока лидером (Telegram-уведомления)
- Отклонение блока с комментарием (`/api/miniapp/notify-rejection`)
- Test mode урока: `?test=1` (2x speed, 5% threshold, 5-char minimum)
- Streak механика (с Catch Me Up при пропуске 2-7 дней)
- Auto-cohort (малые группы до 12 человек)
- B2B регистрация церквей-партнёров

✅ **Архитектура задокументирована:**
- Полный Spec-First Pipeline пройден (PROJECT_IDEA + SPEC + UI_UX_BRIEF)
- Двойная архитектура описана в CLAUDE.md (118 строк)
- Команда из 6 субагентов под актуальный стек

🔄 **В процессе (post-MVP, не блокирует):**
- ЮKassa подписки для пасторов (3K/10K ₽/мес)
- AI-ассистент лидера (нужен feedback от 5 церквей)
- UI пастора для setup-telegram cohort групп

---

## База данных (Supabase)

**Project ref:** `aejhlmoydnhgedgfndql`

**Применено миграций:** 14 (последние 4 — 27.04):
- `20260423181719_add_admin_approved_blocks_unlocked_telegram`
- `20260425160724_add_verse_content_columns`
- `20260425160915_add_city_to_profiles`
- `20260425172419_add_gornitsa_and_nastavnik`
- `20260425193753_fix_admin_rls_select_policies`
- `20260425202226_get_leader_chat_id_function`
- `20260426111813_add_registration_fields`
- `20260426120000_add_streak_logs` ← Spec-First
- `20260426120001_add_churches_and_cohorts` ← Spec-First
- `20260426120002_add_block_rejections_and_notifications` ← Spec-First
- `drop_test_clients_orders_lesson9` ← очистка

**Таблицы (14):**
- `profiles` (25 колонок: streak_count, last_active_date, church_id, telegram_chat_id, и т.д.)
- `blocks`, `lessons`, `student_progress`, `journal_entries`, `bible_verses`
- `uploads`, `weekly_submissions`
- 🆕 `streak_logs` — лог дневной активности
- 🆕 `churches` — B2B-партнёры с invite_token
- 🆕 `cohorts` + `cohort_members` — малые группы
- 🆕 `block_rejections` — история отклонений
- 🆕 `notifications_log` — лог push/email

**Удалено:** тестовые `clients`, `orders` (мусор урока 9)

---

## API Routes (Next.js)

**Существующие:**
- `POST /api/miniapp/notify` — уведомление лидеру при форуме
- `POST /api/miniapp/notify-rejection` — отклонение блока с комментарием
- `POST /api/miniapp/notify-registration` — уведомление admin о регистрации
- `POST /api/admin/approve` — одобрение блока
- `POST /api/student/journal` — сохранение форума
- `POST /api/telegram/webhook` — Telegram bot webhook
- `POST /api/auth/logout`

**Новые (27.04):**
- `POST /api/miniapp/streak` — запись активности + обновление streak_count
- `POST /api/miniapp/cohort` — auto-cohort: найти/создать малую группу
- `POST /api/admin/church/register` — регистрация церкви-партнёра (создаёт пастора + church + invite_token)
- `POST /api/admin/cohort/setup-telegram` — привязка Telegram-чата к cohort + createChatInviteLink
- `GET /api/cron/reset-streaks` — сброс streak >7 дней (Vercel Cron 00:00 UTC)
- `GET /api/cron/archive-cohorts` — архивация cohorts >14 дней (Vercel Cron 01:00 UTC)

**Vercel Cron:** настроен через `apps/web/vercel.json` (требует `CRON_SECRET` env var на Vercel — добавить вручную).

---

## Структура проекта

```
/                                # Корень (9 MD)
├── CLAUDE.md, PROJECT_IDEA.md, SPEC.md, UI_UX_BRIEF.md
├── SPEC_TEMPLATE.md, CREST.md, METHODOLOGY.md, START_HERE.md, HANDOVER.md
├── apps/web/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── miniapp/{notify,notify-rejection,notify-registration,streak,cohort}/
│   │   │   │   ├── admin/{approve,church/register,cohort/setup-telegram}/
│   │   │   │   ├── cron/{reset-streaks,archive-cohorts}/
│   │   │   │   ├── student/journal/
│   │   │   │   ├── telegram/webhook/
│   │   │   │   └── auth/logout/
│   │   │   ├── (admin)/admin/, student/, login/, register-church/
│   │   │   └── page.tsx, layout.tsx
│   │   ├── lib/, hooks/, middleware.ts
│   │   └── public/miniapp/         # Vanilla Telegram Mini App
│   ├── vercel.json                 # Cron schedule
│   └── package.json
├── supabase/migrations/             # 14 миграций
├── .claude/
│   ├── agents/                     # 6 субагентов (все обновлены)
│   ├── rules/                      # 5 правил
│   └── skills/                     # 10 скиллов (включая /deploy /handoff /feature-spec)
└── docs/
    ├── spec-first/                 # 01-reverse + 02-problem
    ├── course-toolkit/             # 19 шаблонов курса Алекса
    ├── legacy/                     # 7 устаревших
    └── research/                   # 1 (десятина)
```

---

## Активные аккаунты

| Роль | Email | Где креды |
|------|-------|-----------|
| Постоянный admin | sleezard@gmail.com | memory/admin_credentials.md |
| Bot | @cross_bot | env: TELEGRAM_BOT_TOKEN |

**Студент-тестовик** — создавать через `/auth/v1/signup` API (см. `feedback_create_students.md` в памяти, никогда через прямой SQL в auth.users).

---

## Vercel — env vars (проверить!)

Обязательно должны быть установлены:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `RESEND_API_KEY`
- `CRON_SECRET` ← **добавить вручную для cron-защиты**
- `NEXT_PUBLIC_SITE_URL` ← опционально, default `krest-platform-web.vercel.app`

Команды:
```bash
vercel env ls
vercel env add CRON_SECRET production
```

---

## Команда субагентов

| Агент | Модель | Зона |
|-------|--------|------|
| `database-architect` | Opus | Schema, миграции, RLS — все обновлено для двойной архитектуры |
| `backend-engineer` 🆕 | Sonnet | Next.js API routes, Server Actions |
| `frontend-developer` | Sonnet | Vanilla miniapp + Next.js admin |
| `content-manager` | Sonnet | 6 блоков курса, RU/EN |
| `qa-reviewer` | Sonnet (БЕЗ Write) | 8 категорий проверки |
| `agent-architect` | Opus | Координация, деплой |

**Все агенты переписаны 27.04** под двойную архитектуру (Next.js + Vanilla).

---

## Скиллы

- `/add-new-block`, `/run-migration`, `/run-qa-review` (старые)
- `/create-migration`, `/implement-feature`, `/supabase`, `/supabase-postgres-best-practices` (общие)
- `/deploy` 🆕 — pre/deploy/post-deploy чек-лист
- `/handoff` 🆕 — генерация HANDOVER.md
- `/feature-spec` 🆕 — генерация FEATURE_SPEC.md для новых фич

---

## TODO для следующей сессии

### Высокий приоритет
1. **Проверить Vercel env `CRON_SECRET`** — иначе cron-задачи незащищены
2. **Smoke test после деплоя:** `/api/miniapp/streak`, `/api/miniapp/cohort`, `/register-church`
3. **Тест в реальном Telegram:** один студент проходит блок 1, проверить что streak +1, cohort создалась

### Средний (post-MVP)
4. **UI пастора для cohort-groups** — `/admin/cohorts` страница, кнопка "подключить Telegram-группу"
5. **Email digest для лидера** — daily / weekly summary через Resend
6. **Лендинг главной страницы** — сейчас только `/login`, нужен hero + pricing

### Низкий (после валидации)
7. **ЮKassa подписки** — после 5+ платящих церквей
8. **AI-ассистент лидера** — после feedback
9. **Path of Salvation** — следующий курс после КРЕСТ

---

## Что прочитать первым в новой сессии

1. **`HANDOVER.md`** (этот файл)
2. **`CLAUDE.md`** (всегда автоматически)
3. **`SPEC.md`** — если работаем над новой фичей
4. **`memory/MEMORY.md`** — индекс памяти

Команды быстрого старта:
```bash
git status
git log --oneline -10
mcp__supabase__list_migrations
```

---

## Контекст принятых решений (для следующей сессии)

- **Двойная архитектура (Next.js + Vanilla)** — вынужденный choice: Telegram WebView плохо работает с Next.js SSR
- **Streak — Catch Me Up при 2-7 дней пропуска** — взято от Bible.com, серия не сбрасывается
- **Auto-cohort до 12 человек** — взято от Alpha Course (живые малые группы)
- **B2B-монетизация только** — студентам платформа всегда бесплатна (стандарт ниши)
- **Telegram Bot НЕ создаёт группы программно** — это ограничение API. Пастор создаёт сам, привязывает chat_id через `/api/admin/cohort/setup-telegram`
- **Cron через Vercel** — не Edge Functions (запрет в CLAUDE.md), не отдельный VPS

---

*Версия 2.0 | 2026-04-27 | После финального этапа Plan B + post-MVP cron/B2B*
