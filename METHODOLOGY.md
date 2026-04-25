# METHODOLOGY.md — Методология разработки КРЕСТ

> Читай этот файл чтобы понять КАК мы строим проект, а не ЧТО строим.

---

## Принцип работы

**Ты — архитектор. Claude Code — исполнитель.**

```
Архитектор (ты):         Исполнитель (Claude Code):
- Описывает проблему  →  - Воспроизводит баг
- Утверждает план     →  - Пишет код
- Принимает результат →  - Делает коммит
- Тестирует фичи      →  - Находит регрессии
```

Не пиши код руками — управляй через промпты.

---

## Порядок работы над задачей

### 1. Новая фича
1. Описать задачу по шаблону [SPEC_TEMPLATE.md](SPEC_TEMPLATE.md)
2. Согласовать с Claude Code какой субагент реализует
3. Запустить субагента через `/implement-feature`
4. QA Review через `/run-qa-review`
5. Коммит + пуш в GitHub

### 2. Баг
1. Скопировать промпт из [bug-fix-prompt.md](bug-fix-prompt.md)
2. Описать симптом
3. Claude Code проходит 6 шагов: reproduce → root cause → fix → regress-тест

### 3. Ревью кода
Скопировать промпт из [code-review-prompt.md](code-review-prompt.md) и запустить.

---

## Субагенты — правила вызова

| Когда | Кого вызывать |
|-------|---------------|
| Изменения в schema.sql, миграции, RLS | Database Architect |
| HTML/CSS/JS страницы, YouTube IFrame | Frontend Developer |
| Редактор контента, блоки/уроки | Content Manager |
| После изменений в lesson flow | QA Reviewer |
| Деплой, координация, .env | Agent-Architect |

**Правило Context7:** перед любым кодом с внешней библиотекой — запросить документацию.

---

## Git-дисциплина

```bash
# Структура коммитов
feat: добавить уведомление в Telegram
fix: исправить no-skip polling
chore: обновить START_HERE.md

# Ветки
main — только стабильный код
feat/telegram-bot — новые фичи
fix/noskip-polling — исправления
```

Каждая задача = отдельная ветка → PR → merge в main.

---

## Файловая дисциплина

- `js/config.js` — трогать только если явно нужно менять Supabase или i18n
- `supabase/schema.sql` — актуальная схема всегда здесь
- `supabase/migrations/` — каждая миграция отдельным файлом с датой
- `docs/` — архитектурные решения, не трогать без причины

---

## Переменные окружения

```
.env          → только локально, в .gitignore
Vercel ENV    → для продакшна через Dashboard
Никогда в коде → service_role key, токены, пароли
```

---

## Запрещено делать в Claude Code

- Менять стек (Vanilla JS — это осознанный выбор)
- Устанавливать npm пакеты
- Удалять requireAuth() / requireAdmin()
- Использовать alert() вместо toast()
- Нарушать 7-шаговый flow урока

---

## Деплой (когда готово)

1. QA Review пройден
2. Security Review пройден (см. `code-review-prompt.md`)
3. GitHub репозиторий актуален
4. Vercel ENV-переменные настроены
5. `vercel --prod` или автодеплой из main

---

## Ссылки

| Документ | Назначение |
|----------|-----------|
| [START_HERE.md](START_HERE.md) | Навигатор по проекту |
| [SPEC.md](SPEC.md) | Бизнес-логика (источник истины) |
| [CLAUDE.md](CLAUDE.md) | Правила для Claude Code |
| [docs/LESSON_FLOW.md](docs/LESSON_FLOW.md) | Архитектура урока |
| [docs/SUPABASE_SCHEMA.md](docs/SUPABASE_SCHEMA.md) | Схема базы данных |
| [docs/VIDEO_PROTECTION.md](docs/VIDEO_PROTECTION.md) | YouTube no-skip |
| [docs/TELEGRAM_BOT.md](docs/TELEGRAM_BOT.md) | Telegram уведомления |
