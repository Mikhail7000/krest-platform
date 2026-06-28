# КРЕСТ — Платформа управляемого ученичества

## Обзор

КРЕСTТ — **внутренняя платформа церкви** (не коммерческая) для управляемого ученичества по 10 блокам курса «Крест». Один Next.js обслуживает три аудитории: учеников (через Telegram MiniApp + браузер), кураторов (веб-админка), руководство (super-admin). Архитектура **мультикурсовая**: после КРЕСТ откроется «10 писем», далее «20 писем».

**Старт — только Бали.** Платформа поддерживает 8 стран + 19+ городов; остальные локации становятся доступны по мере назначения кураторов.

## Источники истины

- **`SPEC.md`** v3.0 — техническая спецификация (что строим)
- **`UI_UX_BRIEF.md`** v3.0 — дизайн-система (как выглядит)
- **`PROJECT_IDEA.md`** — зачем и для кого
- **`memory/MEMORY.md`** — индекс рабочих решений (читать выборочно по indexed описаниям)

При конфликте кода и спеки — **сообщить пользователю**, не править молча.

## Стек

- **Веб + MiniApp + админка:** Next.js 16 (App Router) + TS strict + React 19 + Tailwind v4 + shadcn/ui + Framer Motion. Server Components по умолчанию.
- **Backend:** Supabase (PostgreSQL 15, Auth, RLS, Storage, Realtime) + Next.js API Routes
- **Видео:** Kinescope (embed iframe + кастомный no-skip overlay)
- **ИИ:** Anthropic Messages API (`claude-sonnet-4-6`) — тренажёр стихов; AI-помощник post-MVP
- **AI-генерация изображений:** Midjourney (через подписку Михаила, $30/мес)
- **Уведомления:** Telegram Bot API + Resend SMTP
- **Деплой:** Vercel + Supabase Cloud

**НЕ использовать:** Cursor, Lovable, n8n, Edge Functions, Stripe, OpenAI, ЮKassa, видеосозвон в платформе, YouTube IFrame (заменён на Kinescope), Vanilla MiniApp (всё на Next.js).

## Архитектура

```
apps/web/src/app/
├── /                        # Лендинг (публичный, hero+5 секций)
├── /login                   # Вход
├── /m/*                     # MiniApp (Telegram + браузер, фич-парити)
│   ├── onboarding           # Язык → страна → город → куратор
│   ├── dashboard            # Список курсов и блоков
│   ├── lesson/[blockId]     # 12 пунктов ДЗ
│   ├── trainer              # ИИ-тренажёр стихов
│   ├── chat                 # Двусторонний чат с куратором
│   ├── important            # Раздел «Важно» (только curator+)
│   ├── achievements         # Ачивки в библейском стиле
│   └── profile              # Профиль ученика
├── /admin/*                 # Веб-админка
│   ├── dashboard, group, calendar, student/[id], exams, chat, important
│   ├── content              # super_admin only
│   ├── cities, roles        # super_admin / admin
│   └── analytics
└── /api/*                   # API routes (см. SPEC.md блок 3)

apps/web/src/
├── components/ui/           # shadcn/ui (генерация через CLI)
├── components/features/     # Кастомные feature-компоненты
├── lib/                     # Supabase clients, helpers, design-tokens
├── hooks/, types/
└── middleware.ts            # /m/* пропускается без maintenance gate

apps/web/public/miniapp/     # ⚠️ LEGACY — Vanilla MiniApp, постепенная миграция в /m/*
                             # Не удалять до полной миграции. Новый код — только в /m/*

supabase/migrations/         # Инкрементальные миграции (только так!)
docs/spec-first/             # Артефакты Spec-First Pipeline
```

## Доменные правила (критично)

### 12-пунктовая модель ДЗ блока (одинакова для всех 10 блоков)

| # | Пункт | Обязателен | Способ |
|---|---|---|---|
| 1 | Подготовка (info) | — | авто |
| 2 | Основное видео | ✅ | Kinescope no-skip ≥95% |
| 3 | Дополнительное видео | ✅ | Kinescope no-skip ≥95% |
| 4 | Форум-рефлексия (3 вопроса) | ✅ | text → push куратору |
| 5 | Конспект | ✅ | text/photo → одобрение |
| 6 | Писать крест ежедневно | ✅ | фото в день, мин. 7 дней |
| 7 | Местописания | ✅ | видео-кружок ИЛИ загрузка |
| 8 | Прослушать молитвы (только Блок 1) | — | авто |
| 9 | Молитва ежедневно | — | галочка на доверии |
| 10 | Сдача куратору (офлайн) | ✅ | manual approve куратором |
| 11 | Эпоха пятницы | ✅ | text/photo/voice |
| 12 | Эмоции + ежедневный отчёт | ✅ | text каждый день, алерт куратору при пропуске |

### Block gate
`is_block_completed(user_id, block_id)` — все обязательные ✅-пункты одобрены → unlock следующего блока. Для recurring пунктов (6, 12) минимум 7 уникальных дней.

### Дневные практики — частые баги (журнал отладки)
«Закрытый день» = за ОДНУ локальную дату сданы ВСЕ 4 практики (фото + молитва + местописания-видео + пересказ-аудио); 7 закрытых дней → следующий блок. Каждый из 4 экранов должен:
- **считать прогресс по `closed_days`** (rpc `user_closed_days`), а НЕ по числу своих сабмишенов. Баг: экран фото показывал «фото-дни», молитва — «молитва-дни» (≠ закрытым дням; вводит в заблуждение). Причина: брали `photo_days`/`prayed_days` вместо `closed_days`.
- **НЕ капить список на 7 слотов** через `while (days.length < 7)`. Баг: при частичных днях (сдал не всё за дату) незакрытые дни занимали слоты → до 7 закрытых не добраться, новые слоты не появлялись. Причина: будущих слотов должно быть `max(0, 7 - closedDays - 1)` (закрытые + сегодня + будущие = 7 закрываемых), незакрытые прошлые дни идут «сверх».
- **статус по дню — через `is_day_closed`**, а не «сдано когда-либо»: ✅ день закрыт / «практика есть · день не закрыт» (только для ПРОШЛЫХ дат `date < today`; сегодняшняя сдача — обычная галочка).
- **ежедневные экраны** (местописания режим `practice_mode=null`, пересказ) считают «сделано СЕГОДНЯ» по `effective_date == studentLocalToday`, а НЕ по «passed когда-либо» — иначе со 2-го дня нельзя пересдать и день не закрыть.

Эталон реализации — `api/m/cross-photo/[blockId]` + `CrossPhotoClient.tsx`. Все даты — `studentLocalToday` (пояс города, дефолт Бали), сравнение строк YYYY-MM-DD.

### Иерархия экзаменов
- 10 block-gates (пункт 10 каждого блока, у своего куратора, офлайн)
- 1 mid-exam после Блока 5 «Состояние Неверующего» (у другого куратора)
- 1 final-exam после Блока 10 «5 Уверенностей» (у admin) → ачивка «Мастер Креста» + unlock курса 10 писем

### Ролевая иерархия

| Роль | Кто назначает | Что может |
|---|---|---|
| `super_admin` | По seed (Михаил, Алекс, Эля, Игорь) | Всё. Назначать роли. CRUD городов. Передача управления |
| `admin` | super_admin | Назначать кураторов в зоне. Прикреплять учеников |
| `curator` | super_admin / admin | Принимать ДЗ. Видеть свою группу + кураторов своего города |
| `student` | super_admin / admin / curator | Учится |

**Передача прав super-admin** — явное действие через UI с двойным подтверждением.

### Видимость как маркер прогрессии
- Ученик пока учится КРЕСТ → видит только свою группу
- Сдал КРЕСТ → видит всех учеников платформы глобально
- … расширяется с каждым пройденным курсом
- Куратор видит свою группу + кураторов своего города + их учеников
- Admin / super-admin видят всё

Реализация: PL/pgSQL функция `is_visible_to(viewer_id, target_id)` + RLS на `profiles`.

### Гео
- 8 стран + 19+ городов в РФ
- На старте активен **только Бали**
- CRUD через `/admin/cities` (super-admin)
- При регистрации — выбор языка → страны → города → куратора

### Только русский на старте
EN — позже с **отдельными материалами** (отдельная база контента). Поле `lang` остаётся, на старте всегда `'ru'`.

## Правила БД (Supabase)

- Изменения схемы — **ТОЛЬКО через миграции** в `supabase/migrations/`
- RLS обязательна на каждой таблице
- `IF NOT EXISTS` на всех `CREATE TABLE` / `ADD COLUMN`
- `service_role` ключ — никогда в браузере, только server-side
- snake_case для таблиц и колонок
- Деньги хранить в INTEGER (копейки) — на случай будущих платных функций
- Project ref Supabase: `aejhlmoydnhgedgfndql`
- Подробности — `.claude/rules/database.md`

## Правила кодирования

- **TS strict** без `any`, camelCase для функций/переменных, PascalCase для компонентов
- **Max 200 строк/файл**, импорты через `@/`
- **Server Components по умолчанию**, `'use client'` только когда нужно
- **XSS:** ввод ученика → `textContent` или React (auto-escape), контент куратора → можно `innerHTML` через DOMPurify
- **Уведомления:** только через `toast()` из shadcn (не `alert`/`confirm`/`prompt`)
- **i18n:** строки через i18n-словарь, не хардкод. На старте только `ru`.

## Дизайн-направление

- **Тема C: светлый с тёмными акцентами** (см. UI_UX_BRIEF.md)
- **Primary reference:** superhuman.com
- **Никакого «церковного стиля»:** нет золота, готики, икон, орнаментов
- **Cursor glow эффект** на тёмных секциях (Framer Motion)
- **Hero лендинга:** небеса+крест из Midjourney + цифры 237/5000/7000/7000 + Матфея 28:18-20

## MCP

- **Context7** (всегда): `use context7` перед кодом любой внешней библиотеки (Supabase, Kinescope, Anthropic, Framer Motion)
- **Supabase** (для SQL): project_ref `aejhlmoydnhgedgfndql`
- **GitHub** (PRs, issues)

## Субагенты (зоны пересмотрены под v3.0)

| Агент | Модель | Зона |
|---|---|---|
| `database-architect` | Opus | Миграции (6→10 блоков, новые таблицы), RLS, функции `is_visible_to`/`is_block_completed` |
| `backend-engineer` | Sonnet | Next.js API routes, Server Actions, интеграции (Telegram, Kinescope, Anthropic, Resend) |
| `frontend-developer` | Sonnet | **React/TS** (не vanilla) — Next.js MiniApp `/m/*` + админка `/admin/*` |
| `content-manager` | Sonnet | Заливка контента блоков (transcript, ДЗ, местописания) |
| `qa-reviewer` | Sonnet | Code/security review, RLS-аудит, lesson flow проверка (БЕЗ Write) |
| `agent-architect` | Opus | Координация субагентов при больших миграциях |

**Скиллы:** `/add-new-block`, `/run-migration`, `/run-qa-review`, `/deploy`, `/handoff`, `/feature-spec`

## Команды

```bash
npm --workspace=@krest/web run dev      # Next.js разработка
npm --workspace=@krest/web run build    # Продакшн сборка
npm --workspace=@krest/web run lint     # Линтер
npx supabase db push                    # Применить миграции
```

## Maintenance mode

Платформа закрыта для всех кроме Михаила (с 2026-04-29). `MAINTENANCE_MODE=true` в Vercel. Доступ:
- Telegram через `@cross_bot` (whitelist chat_id 255214568)
- Web через `?bypass=<MAINTENANCE_BYPASS_TOKEN>`
- `/m/*` пропускается без maintenance gate (для PoC и постепенной миграции)

Подробности в `memory/project_maintenance_mode_active.md`.

---

*Версия 3.0 | Дата: 2026-05-01 | Замещает v2.0 | Соответствует SPEC v3.0 и UI_UX_BRIEF v3.0*
