---
name: deploy
description: Pre-deploy checklist + deploy + post-deploy smoke tests for КРЕСТ Vercel deployment
---

# Скилл: Деплой КРЕСТ на Vercel

## Триггер
Пользователь говорит "задеплой" / "деплой в прод" / `/deploy`.

## PRE-DEPLOY (до деплоя)

### 1. Код и сборка
```bash
# TypeScript ошибки = блокер
cd apps/web && npx tsc --noEmit
# Должно быть 0 ошибок. Если нет — исправить и не деплоить.

# Сборка
cd apps/web && npm run build
# Без warnings в критичных местах

# Проверка hardcoded секретов
grep -rn "sbp_\|sk-\|ghp_\|re_" apps/web/src/ apps/web/public/ --exclude-dir=node_modules
# Должен вернуть пусто (только process.env.* в server routes)
```

### 2. Env-переменные на Vercel
```bash
vercel env ls
```
Должны быть:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (только server)
- `TELEGRAM_BOT_TOKEN` (только server)
- `RESEND_API_KEY` (если используется)

### 3. База данных
- Все миграции в `supabase/migrations/` применены через Supabase MCP или SQL Editor
- RLS включён на всех таблицах
- Тестовые аккаунты не в проде

### 4. Целевой проект
```bash
vercel whoami         # текущий аккаунт
vercel project ls     # должен быть krest-platform-web
```

## DEPLOY

```bash
# Из корня репозитория
vercel --prod

# Следить за логами сборки
# При ошибках SWC parser / module not found — исправлять немедленно
```

## POST-DEPLOY (после деплоя)

### Smoke tests
```bash
# Health check
curl -s https://krest-platform-web.vercel.app/api/health | jq .

# Главная страница
curl -sI https://krest-platform-web.vercel.app/ | head -5
# 200 OK

# Mini app static
curl -sI https://krest-platform-web.vercel.app/miniapp/index.html | head -5
# 200 OK + content-type: text/html
```

### Ручная проверка
- [ ] Лендинг загружается, нет ошибок в консоли
- [ ] `/login` работает (форма + Supabase Auth)
- [ ] Mini app `/miniapp/index.html` показывает регистрацию (если не залогинен)
- [ ] Telegram bot @cross_bot открывает Mini App
- [ ] Тест: новый студент регистрируется → admin получает push в Telegram

### Логи
```bash
vercel logs --follow
# Первые 20 строк — без 500-х ошибок
```

## Если что-то сломалось — Rollback

### Vercel
1. Dashboard → Deployments → найти предыдущий рабочий → "Promote to Production"

### Supabase миграция
1. Dashboard → Database → Backups → restore последний бэкап
2. ИЛИ написать обратную миграцию (`DROP COLUMN IF EXISTS ...`)

## Шаблон отчёта о деплое

```markdown
## Deploy Report — КРЕСТ
**Дата:** YYYY-MM-DD HH:MM
**Версия:** v{git short SHA}
**Деплоил:** Михаил (через /deploy)

### Что задеплоено
- [ ] Frontend (Vercel)
- [ ] Миграции БД (если были)

### Smoke tests
- [ ] Health endpoint: OK
- [ ] Лендинг загружается: OK
- [ ] Регистрация работает: OK
- [ ] Telegram push: OK

### Проблемы
- (нет / описание)

### Время
- Начало: HH:MM
- Конец: HH:MM
```
