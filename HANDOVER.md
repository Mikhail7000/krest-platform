# HANDOVER — КРЕСТ Miniapp
> Дата: 2026-04-26 | Актуальная версия

---

## Статус платформы

✅ Деплой работает: `https://krest-platform-web.vercel.app/miniapp/`  
✅ Дизайн (небесная тема) отображается  
✅ Telegram уведомления лидеру работают  
✅ Admin панель: одобрение, список студентов  

---

## Аккаунты

| Роль | Email | Пароль |
|------|-------|--------|
| Студент 1 | student@krest.app | Krest2024! |
| Студент 2 | student2@krest.app | Krest2024! |
| Лидер (admin) | admin@krest.app | (у Михаила) |

---

## Как создавать новых студентов (правильная стратегия)

❌ Прямой SQL INSERT в auth.users — НЕ работает (Supabase Auth требует instance_id и другие поля, прямой SQL их не заполняет правильно).

✅ Правильно — через Supabase signup API + обновить профиль:

**Шаг 1** — создать через API (в терминале):
```bash
curl -s -X POST "https://aejhlmoydnhgedgfndql.supabase.co/auth/v1/signup" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlamhsbW95ZG5oZ2VkZ2ZuZHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTkxNjEsImV4cCI6MjA5MjE3NTE2MX0.OhWK6etLZPw6_uWUNxJExCNEBdKg_JGWe50s4n0JCyw" \
  -H "Content-Type: application/json" \
  -d '{"email":"НОВЫЙ@EMAIL.COM","password":"ПАРОЛЬ"}'
```

**Шаг 2** — обновить профиль (в Supabase SQL Editor):
```sql
UPDATE public.profiles 
SET full_name = 'Имя Студента', blocks_unlocked = 1, onboarding_done = true
WHERE email = 'НОВЫЙ@EMAIL.COM';
```

---

## Что было исправлено в этой сессии

| # | Проблема | Решение | Коммит |
|---|----------|---------|--------|
| 1 | Дизайн не отображался на Vercel | Middleware перехватывал CSS/JS → добавил `pathname.startsWith('/miniapp/')` early return | 9ff8bd9 |
| 2 | Все деплои падали с Error | `createClient` вызывался вне функции + env vars не были в turbo.json | 68de28a |
| 3 | Новый студент не мог войти | Не создавалась запись в `auth.identities` | — (SQL стратегия) |

---

## Структура miniapp

```
apps/web/public/miniapp/
  index.html       — дашборд студента
  lesson.html      — урок (видео → форум 3 вопроса → конспект)
  admin.html       — панель лидера
  trainer.html     — тренажёр стихов
  profile.html     — профиль
  setup.html       — онбординг
  css/styles.css   — небесная тема (navy/gold, glassmorphism)
  js/config.js     — Supabase init + переводы
  js/auth.js       — requireAuth, requireAdmin, toast

apps/web/src/
  middleware.ts                        — пропускает /miniapp/* без авторизации
  app/api/miniapp/notify/route.ts     — прокси для Telegram уведомлений
```

---

## Следующие шаги

1. Протестировать полный flow со студентом 2: логин → видео → форум → конспект → уведомление лидеру → одобрение
2. Уведомление студенту при одобрении блока лидером (ещё не сделано)
3. Привязать реального студента к реальному лидеру (через `leader_id` в profiles)
