# CLAUDE.md — Инструкции для Claude Code
> Проект: КРЕСТ | Версия: 1.2 | Дата: 2026-04-23

---

## Что это

КРЕСТ — веб-платформа управляемого ученичества для русскоязычных церквей.
Лидер ведёт студентов через 6 блоков: no-skip видео → форум → одобрение → следующий блок.

## Источники истины

**SPEC.md и PROJECT_IDEA.md — источники истины.**
При конфликте кода и спеки — не исправлять молча. Сообщить пользователю.

---

## Стек (не менять)

```
Frontend:  Vanilla HTML5 + CSS3 + JavaScript (ES6+)
Backend:   Supabase (PostgreSQL, Auth, RLS) — JS SDK напрямую из браузера
Видео:     YouTube IFrame API
Деплой:    Vercel (static) или Beget VPS + nginx
```

НЕ использовать: React, Next.js, npm, Node.js сервер, TypeScript,
Tailwind, n8n, Edge Functions, Stripe, OpenAI.

---

## Структура файлов

```
/login.html              → вход
/student/index.html      → дашборд студента
/student/lesson.html     → урок (видео + форум + конспект)
/student/trainer.html    → тренажёр стихов
/admin/index.html        → дашборд лидера
/admin/students.html     → студенты + одобрение
/admin/editor.html       → редактор блоков
/css/styles.css          → все стили
/js/config.js            → Supabase init + i18n
/js/auth.js              → helpers: requireAuth, requireAdmin, renderNav, toast
```

---

## Доменные правила

**Защита страниц:** каждый `init()` начинается с `requireAuth()` или `requireAdmin()`.

**Flow урока (строго по порядку):**
1. Проверить `blocks_unlocked >= block.order_num` → иначе редирект
2. Показать видео (конспект скрыт)
3. YouTube no-skip: polling 500мс, если `currentTime > maxWatched + 2` → seekTo
4. При `watched >= 95%` → активировать кнопку
5. Кнопка → форум (мин. 20 символов) → сохранить в `journal_entries`
6. Сохранить в `student_progress` (admin_approved: false)
7. Показать конспект + кнопка «Следующий» (🔒 до admin_approved = true)

**Одобрение лидера:**
`UPDATE student_progress SET admin_approved=true WHERE user_id=? AND block_id=? AND lesson_id IS NULL`

**Разблокировка блоков:**
`UPDATE profiles SET blocks_unlocked = blocks_unlocked + 1` (максимум 6, только +1)

**RLS:** включён на всех таблицах. Не использовать service_role в браузере.

**HTML контент:** `content_ru/content_en` вставляется через `innerHTML` — только лидер создаёт, доверяем. Ввод студентов — только через `textContent`.

---

## Запреты (никогда)

- ❌ Не добавлять фреймворки, npm, серверный код
- ❌ Не трогать `js/config.js` без явной команды (там Supabase keys)
- ❌ Не убирать `requireAuth()` / `requireAdmin()` со страниц
- ❌ Не показывать конспект до отправки форума
- ❌ Не разблокировать следующий блок без `admin_approved = true`
- ❌ Не делать перемотку видео возможной
- ❌ Не использовать `alert()` — только `toast()` из auth.js
- ❌ Не создавать таблицы без `IF NOT EXISTS`

---

## Переиспользуемые компоненты (из auth.js)

`renderNav(profile, isAdmin)` → топ-навигация в `#topnav`
`toast(msg, type)` → уведомления ('success'|'error'|'info')
`requireAuth()` / `requireAdmin()` → защита страниц, возвращает `{user, profile}`
`fmtDate(d)` / `ytId(url)` / `ytEmbed(url)` → утилиты

---

## Субагенты — когда кого вызывать

| Субагент | Модель | Задачи |
|----------|--------|--------|
| Database Architect | Opus | schema.sql, RLS, миграции, SQL запросы |
| Frontend Developer | Sonnet | HTML/CSS/JS страницы, YouTube IFrame API |
| Content Manager | Sonnet | editor.html, контент блоков/уроков, content.sql |
| QA Reviewer | Sonnet | проверка после изменений в lesson flow |
| Agent-Architect | Opus | деплой, координация, сложные задачи |

Скиллы: `/add-new-block`, `/run-migration`, `/run-qa-review`

---

## Следующие шаги (приоритет)

1. Запустить SQL-миграции в Supabase:
   `ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN DEFAULT FALSE;`
   `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS blocks_unlocked INTEGER DEFAULT 1;`
2. Задеплоить на Vercel (сейчас только localhost:5500)
3. Добавить email-уведомление студенту при одобрении
