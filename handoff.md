# Session Handoff — КРЕСТ
> Дата: 2026-04-25 | Сессия: Фазы 0–6 + деплой на Vercel завершены

---

## Статус платформы

- ✅ Next.js 16.2.4 задеплоен: https://krest-platform-web.vercel.app
- ✅ Supabase подключён (aejhlmoydnhgedgfndql)
- ✅ TypeScript 0 ошибок
- ✅ Turborepo monorepo: apps/web + packages/supabase
- ✅ GitHub: github.com/Mikhail7000/krest-platform (public)
- ✅ Vercel: krest-platform-web (Hobby team)
- ✅ GitHub Actions: автодеплой через Deploy Hook при пуше в main
- ⏳ Фаза 7 — Telegram Mini App (apps/miniapp/)

---

## Завершённые фазы

### ✅ Фаза 0 — Scaffold
- Turborepo monorepo, Next.js 15→16.2.4, ветка legacy-vanilla

### ✅ Фаза 1 — packages/supabase
- TypeScript типы для 7 таблиц
- Browser / Server / Middleware клиенты

### ✅ Фаза 2 — Auth + Middleware
- `apps/web/src/middleware.ts` — защита роутов
- `apps/web/src/app/login/page.tsx` — форма входа
- `apps/web/src/lib/supabase-browser.ts` — browser клиент
- `apps/web/src/lib/supabase-server.ts` — server клиент с локальным Database типом

### ✅ Фаза 3 — YouTube no-skip
- `src/hooks/use-youtube-no-skip.ts` — polling 500мс, защита от перемотки, 95% callback
- `src/app/student/lesson/[blockId]/page.tsx` — страница урока (server)
- `src/app/student/lesson/[blockId]/LessonClient.tsx` — видео + форум + конспект (client)
- `src/app/api/student/journal/route.ts` — POST: сохранение форума + student_progress

### ✅ Фаза 4 — Дашборд студента
- `src/app/student/page.tsx` — 6 карточек блоков с статусами 🔒 / ▶️ / ⏳ / ✅
- Прогресс-бар, навигация к урокам

### ✅ Фаза 5 — Страницы лидера
- `src/app/admin/page.tsx` — список студентов, счётчик ожидающих
- `src/app/admin/students/[userId]/page.tsx` — детали студента + ответы форума
- `src/app/admin/students/[userId]/ApproveButton.tsx` — кнопка одобрения (client)

### ✅ Фаза 6 — API Routes
- `src/app/api/admin/approve/route.ts` — одобрение + разблокировка блока + Telegram студенту
- `src/app/api/auth/logout/route.ts` — выход из системы

---

## Текущая структура проекта

```
apps/web/src/
  app/
    admin/
      page.tsx                        → лидер: список студентов
      students/[userId]/
        page.tsx                      → лидер: детали студента
        ApproveButton.tsx             → кнопка одобрения
    api/
      admin/approve/route.ts          → POST: одобрить блок
      auth/logout/route.ts            → POST: выход
      student/journal/route.ts        → POST: сохранить форум
    student/
      page.tsx                        → студент: дашборд с блоками
      lesson/[blockId]/
        page.tsx                      → студент: страница урока
        LessonClient.tsx              → YouTube + форум + конспект
    login/page.tsx
    layout.tsx
    globals.css
  hooks/
    use-youtube-no-skip.ts
  lib/
    supabase-browser.ts
    supabase-server.ts               ← ВАЖНО: типы из относительного пути, не @krest/supabase
  middleware.ts
packages/supabase/src/
  types.ts / client.ts / server.ts / middleware.ts / index.ts
```

---

## Важная техническая заметка

**Проблема с @krest/supabase и TypeScript generic:**
`createServerSupabase` из `@krest/supabase` возвращает `never` для данных запросов в app/web контексте (TypeScript generic не пробрасывается через workspace boundary). 

**Решение:** создан `apps/web/src/lib/supabase-server.ts` — локальный server client с прямым импортом `Database` из `../../../../packages/supabase/src/types`. Все server components импортируют из `@/lib/supabase-server`, не из `@krest/supabase`.

Данные из Supabase кастятся через `as unknown as Type` — это TypeScript workaround, runtime поведение корректное.

---

## Следующий шаг: Деплой на Vercel

### Порядок действий:
1. Создать GitHub репозиторий (через gh CLI или github.com)
2. Пуш кода: `git add -A && git commit -m "feat: phases 2-6" && git push`
3. Vercel → New Project → Import GitHub repo
4. Настройки Vercel:
   - **Framework:** Next.js
   - **Root Directory:** `apps/web`
   - **Build Command:** `cd ../.. && npx turbo run build --filter=@krest/web`
   - ИЛИ просто `npm run build` (если без Turborepo)
5. ENV переменные в Vercel (из .env.local):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://aejhlmoydnhgedgfndql.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=sb_publishable_...
   TELEGRAM_BOT_TOKEN=8348590676:AAF...
   TELEGRAM_LEADER_CHAT_ID=255214568
   NEXT_PUBLIC_APP_URL=https://krest.vercel.app
   ```

---

## После деплоя: Фаза 7

- `apps/miniapp/` — Telegram Mini App
- Использует тот же Supabase
- Отдельный деплой (не Vercel)

---

## ENV переменные (.env.local — не коммитить!)

```
NEXT_PUBLIC_SUPABASE_URL=https://aejhlmoydnhgedgfndql.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=sb_publishable_UBF4D_waPjJlkPeT_35Iqg_14ILksGC
TELEGRAM_BOT_TOKEN=8348590676:AAFc2U8sAZTEAHq_xFFbi0cQEoTeugDkx70
TELEGRAM_LEADER_CHAT_ID=255214568
NEXT_PUBLIC_APP_URL=https://krest.vercel.app
```

---

## Как начать следующую сессию

1. Прочитать `handoff.md`
2. `git status` — проверить состояние
3. Если деплой не сделан — начать с GitHub + Vercel
4. Если задеплоено — переходить к Фазе 7 (Mini App)
