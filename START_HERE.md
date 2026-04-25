# START HERE — Платформа КРЕСТ

> Читай этот файл первым в каждой новой сессии Claude Code.

---

## Что это за проект

**КРЕСТ** — веб-платформа управляемого ученичества для русскоязычных церквей.
Лидер ведёт студентов через 6 блоков: no-skip видео → форум → одобрение → следующий блок.

**Стек:** Vanilla HTML5/CSS3/JS + Supabase + YouTube IFrame API + Vercel

---

## Структура проекта

```
/
├── START_HERE.md          ← ты здесь
├── CLAUDE.md              ← правила и инструкции для Claude
├── SPEC.md                ← спецификация проекта (источник истины)
├── METHODOLOGY.md         ← методология разработки
│
├── docs/
│   ├── LESSON_FLOW.md     ← архитектура flow урока (7 шагов)
│   ├── SUPABASE_SCHEMA.md ← схема базы данных
│   ├── VIDEO_PROTECTION.md← YouTube no-skip логика
│   └── TELEGRAM_BOT.md   ← уведомления через Telegram бот
│
├── .claude/
│   ├── agents/            ← 5 субагентов
│   ├── rules/             ← 5 правил
│   └── skills/            ← 5 скиллов
│
├── student/               ← страницы студента
│   ├── index.html
│   ├── lesson.html        ← главная страница урока
│   └── trainer.html
│
├── admin/                 ← страницы лидера
│   ├── index.html
│   ├── students.html      ← одобрение студентов
│   └── editor.html
│
├── js/
│   ├── config.js          ← Supabase init + i18n + Telegram config
│   └── auth.js            ← helpers: requireAuth, toast, renderNav
│
├── css/styles.css
└── supabase/
    ├── schema.sql
    ├── content.sql
    └── migrations/
```

---

## С чего начать в новой сессии

1. Прочитай `CLAUDE.md` — там правила и запреты
2. Прочитай `SPEC.md` — там бизнес-логика
3. Посмотри `docs/LESSON_FLOW.md` — если работаешь с уроком
4. Посмотри `docs/SUPABASE_SCHEMA.md` — если работаешь с БД

---

## MCP серверы

```bash
claude mcp list
# context7  ✓ Connected  — документация библиотек
# supabase  ✓ Connected  — база данных КРЕСТ
# github    ✓ Connected  — репозиторий
```

---

## Субагенты — кто за что отвечает

| Субагент | Задачи |
|----------|--------|
| Database Architect | schema.sql, RLS, миграции |
| Frontend Developer | HTML/CSS/JS, YouTube IFrame |
| Content Manager | editor.html, контент блоков |
| QA Reviewer | проверка lesson flow |
| Agent-Architect | деплой, координация |

---

## Текущий статус проекта

- ✅ Платформа работает локально (localhost:5500)
- ✅ Supabase подключён и настроен
- ✅ MCP серверы подключены
- ✅ Telegram бот @cross_notify_bot создан
- ⏳ Деплой на Vercel — следующий шаг
- ⏳ Привязка Telegram для студентов
