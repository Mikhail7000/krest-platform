# КРЕСТ — Платформа управляемого ученичества

## Обзор
КРЕСТ — Telegram Mini App + Next.js веб-админка для евангельских церквей. Проводит ищущего через 6 блоков знакомства с христианством под наставничеством пастора. Подробности в `PROJECT_IDEA.md` и `SPEC.md`.

**Источники истины:** `SPEC.md` (что строим) и `PROJECT_IDEA.md` (зачем). При конфликте кода и спеки — сообщить пользователю, не править молча.

## Стек

- **Веб-админка пастора:** Next.js 16 (App Router) + TS strict + React 19 + Tailwind v4 + shadcn/ui. Server Components по умолчанию.
- **Telegram Mini App студента:** Vanilla HTML5/CSS3/JS ES6+ + Telegram Web App SDK + Supabase JS SDK напрямую (требование Telegram WebView)
- **Backend:** Supabase (PostgreSQL 15, Auth, RLS, Storage) + Next.js API Routes
- **Интеграции:** YouTube IFrame API, Telegram Bot API, Resend SMTP, ЮKassa (post-MVP), Anthropic API (post-MVP)
- **Деплой:** Vercel + Supabase Cloud

**НЕ использовать:** Cursor, Lovable, n8n, Edge Functions, Stripe, OpenAI.

## Архитектура

```
apps/web/
├── public/miniapp/              # Vanilla Telegram Mini App
│   ├── index.html               # Дашборд / регистрация
│   ├── lesson.html              # Видео + форум + конспект
│   ├── admin.html               # Панель лидера в Telegram
│   ├── trainer.html, profile.html, setup.html
│   ├── css/styles.css           # Все стили miniapp
│   └── js/
│       ├── config.js            # Supabase init + i18n (НЕ ТРОГАТЬ ключи)
│       └── auth.js              # requireAuth, toast, renderNav
│
├── src/                         # Next.js
│   ├── app/
│   │   ├── (admin)/admin/       # Админка лидера
│   │   ├── student/             # Дашборд студента (legacy веб)
│   │   ├── login/, page.tsx     # Лендинг + вход
│   │   └── api/
│   │       ├── miniapp/notify/, notify-rejection/, notify-registration/
│   │       ├── admin/approve/
│   │       ├── student/journal/
│   │       ├── telegram/webhook/
│   │       └── auth/logout/
│   ├── lib/                     # supabase clients, helpers
│   ├── hooks/, types/
│   └── middleware.ts            # Пропускает /miniapp/* без auth

supabase/
├── migrations/                  # Инкрементальные миграции (target)
├── schema.sql                   # Legacy (разбиваем на миграции)
└── content.sql                  # Seed контента блоков

docs/spec-first/                 # Артефакты Spec-First Pipeline
└── 01-reverse-engineering.md, 02-problem-discovery.md
```

## Доменные правила (критично)

**Flow урока (строго по порядку, нарушение = баг):**
1. Проверить `blocks_unlocked >= block.order_num` → иначе редирект
2. Видео (конспект скрыт)
3. YouTube no-skip: polling 500ms, `currentTime > maxWatched + 2` → `seekTo(maxWatched)`
4. При `watched ≥ 95%` → активировать форум
5. Форум (3 вопроса × мин. 100 символов) → `journal_entries`
6. `student_progress` (`admin_approved=false`)
7. Конспект + кнопка "Следующий" (🔒 до `admin_approved=true`)

**Одобрение лидером:**
`UPDATE student_progress SET admin_approved=true WHERE user_id=? AND block_id=?`

**Разблокировка:**
`UPDATE profiles SET blocks_unlocked = blocks_unlocked + 1` (max 6, только +1)

**Отклонение блока (новое):** `DELETE journal_entry + DELETE student_progress` → студент пересдаёт.

## Правила БД (Supabase)

- Изменения схемы — ТОЛЬКО через миграции в `supabase/migrations/`
- RLS обязательна на каждой таблице
- `IF NOT EXISTS` на всех `CREATE TABLE` / `ADD COLUMN`
- Не использовать `service_role` в браузере — только anon
- snake_case для таблиц и колонок
- Деньги хранить в INTEGER (копейки)
- Подробности — `.claude/rules/database.md`

## Правила кодирования

- **Next.js:** TS strict без `any`, camelCase/PascalCase, max 200 строк/файл, импорты через `@/`
- **Vanilla miniapp:** ввод студента → `textContent` (XSS), контент лидера → `innerHTML`, только `toast()` (не `alert()`), строки через `T[LANG]` из `config.js`

## MCP

- **Context7** (всегда): `use context7` перед кодом любой внешней библиотеки
- **Supabase** (для SQL): `project_ref=aejhlmoydnhgedgfndql`
- **GitHub** (PRs, issues)

## Субагенты

| Агент | Модель | Зона |
|-------|--------|------|
| `database-architect` | Opus | schema.sql, миграции, RLS |
| `backend-engineer` 🆕 | Sonnet | Next.js API routes, Server Actions, интеграции |
| `frontend-developer` | Sonnet | HTML/CSS/JS miniapp + Next.js admin UI |
| `content-manager` | Sonnet | editor.html, контент блоков (RU/EN) |
| `qa-reviewer` | Sonnet | Проверка lesson flow, RLS, no-skip (БЕЗ Write) |
| `ai-agent-architect` 🆕 | Opus | Продакшн AI-агенты для платформы (post-MVP) |

Скиллы: `/add-new-block`, `/run-migration`, `/run-qa-review`, `/deploy` 🆕, `/handoff` 🆕, `/feature-spec` 🆕

## Команды

- `npm --workspace=@krest/web run dev` — Next.js разработка
- `npm --workspace=@krest/web run build` — продакшн сборка
- `npm --workspace=@krest/web run lint` — линтер
- `npx supabase db push` — применить миграции

---

*Версия 2.0 | Дата: 2026-04-26 | 110 строк | Соответствует Spec-First Pipeline методологии*
