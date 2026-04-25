# Session Handoff — КРЕСТ
> Дата: 2026-04-25 | Сессия: Фазы 0–7 scaffold завершены

---

## Статус платформы

- ✅ Next.js 16.2.4 задеплоен: https://krest-platform-web.vercel.app
- ✅ Supabase подключён (aejhlmoydnhgedgfndql)
- ✅ TypeScript 0 ошибок
- ✅ Turborepo monorepo: apps/web + apps/miniapp + packages/supabase
- ✅ GitHub: github.com/Mikhail7000/krest-platform (public)
- ✅ Vercel: krest-platform-web (Hobby team) — автодеплой через GitHub Actions
- ✅ SVG-диаграммы: public/content/block1–6.svg, прописаны в blocks.content_ru
- ⏳ Фаза 7 — Telegram Mini App scaffold готов, **нужен деплой на Vercel**

---

## Завершённые фазы

### ✅ Фаза 0 — Scaffold
- Turborepo monorepo, Next.js 15→16.2.4, ветка legacy-vanilla

### ✅ Фаза 1 — packages/supabase
- TypeScript типы для 7 таблиц

### ✅ Фаза 2 — Auth + Middleware
- `apps/web/src/middleware.ts`, login/page.tsx, supabase-browser/server.ts

### ✅ Фаза 3 — YouTube no-skip
- `use-youtube-no-skip.ts`, LessonClient.tsx, api/student/journal/route.ts

### ✅ Фаза 4 — Дашборд студента
- `student/page.tsx` — 6 карточек со статусами 🔒 / ▶️ / ⏳ / ✅

### ✅ Фаза 5 — Страницы лидера
- `admin/page.tsx`, `admin/students/[userId]/page.tsx`, ApproveButton.tsx

### ✅ Фаза 6 — API Routes
- `api/admin/approve/route.ts` — одобрение + разблокировка + Telegram

### ✅ Фаза 7 — SVG конспекты
- 6 SVG-диаграмм в `apps/web/public/content/block1–6.svg`
- `blocks.content_ru` в Supabase: `<img src="/content/blockN.svg">` + HTML текст

### 🔨 Фаза 8 — Telegram Mini App (scaffold готов)

**Файлы:** `apps/miniapp/`

| Файл | Назначение |
|------|-----------|
| `index.html` | Логин + дашборд студента (статусы блоков) |
| `lesson.html` | YouTube no-skip → форум (20+ символов) → конспект |
| `admin.html` | Лидер: список ожидающих + одобрение одним тапом |
| `css/styles.css` | Telegram CSS vars + Apple-style UI |
| `js/config.js` | Supabase init + Telegram.WebApp.ready() + i18n |
| `js/auth.js` | requireAuth, requireAdmin, toast, showLoading |
| `vercel.json` | X-Frame-Options ALLOWALL, CSP для Telegram iframe |

**Бизнес-логика в miniapp:**
- Те же правила: no-skip polling 500мс, форум 20+ символов, блоки только после admin_approved
- Haptic feedback при одобрении и ошибках
- Тема: автоматически берёт CSS vars из Telegram (`--tg-theme-*`)

---

## Следующий шаг: Деплой Telegram Mini App

### Шаг 1 — Новый проект на Vercel

1. Зайти на [vercel.com](https://vercel.com) → **New Project**
2. Импортировать `github.com/Mikhail7000/krest-platform`
3. Настройки проекта:
   - **Framework Preset:** Other
   - **Root Directory:** `apps/miniapp`
   - **Build Command:** *(пусто)*
   - **Output Directory:** *(пусто)*
4. ENV переменные — **не нужны** (ключи Supabase захардкожены в `config.js`)
5. Deploy → получить URL типа `krest-miniapp.vercel.app`

### Шаг 2 — Прописать URL в BotFather

Открыть чат с [@BotFather](https://t.me/BotFather):
```
/newapp
→ выбрать бота (тот, чей TELEGRAM_BOT_TOKEN в .env)
→ Short Name: krest
→ URL: https://krest-miniapp.vercel.app
```
Или для кнопки меню:
```
/setmenubutton
→ выбрать бота
→ URL: https://krest-miniapp.vercel.app
→ Button Text: КРЕСТ
```

### Шаг 3 — Обновить approve API

В `apps/web/src/app/api/admin/approve/route.ts` добавить кнопку Mini App в Telegram-сообщение студенту:

```typescript
// Текущий код отправляет просто текст
// Нужно добавить inline_keyboard с кнопкой Web App:
reply_markup: {
  inline_keyboard: [[{
    text: '✝️ Открыть КРЕСТ',
    web_app: { url: 'https://krest-miniapp.vercel.app' }
  }]]
}
```

---

## Текущая структура проекта

```
apps/
  web/src/
    app/
      admin/page.tsx, students/[userId]/page.tsx, ApproveButton.tsx
      api/admin/approve/route.ts, auth/logout/route.ts, student/journal/route.ts
      student/page.tsx, lesson/[blockId]/page.tsx, LessonClient.tsx
      login/page.tsx, layout.tsx, globals.css
    hooks/use-youtube-no-skip.ts
    lib/supabase-browser.ts, supabase-server.ts
    middleware.ts
  web/public/content/
    block1.svg … block6.svg        ← SVG конспекты
  miniapp/
    index.html                     ← студент: логин + дашборд
    lesson.html                    ← студент: урок
    admin.html                     ← лидер: одобрение блоков
    css/styles.css
    js/config.js, auth.js
    vercel.json
packages/supabase/src/
  types.ts / client.ts / server.ts / middleware.ts / index.ts
```

---

## Важные технические заметки

**TypeScript workaround:** `createServerSupabase` из `@krest/supabase` возвращает `never` через workspace boundary. Решение: `apps/web/src/lib/supabase-server.ts` с прямым импортом типов. Все server components → `@/lib/supabase-server`.

**SVG in konspekt:** `blocks.content_ru` начинается с `<img src="/content/blockN.svg">`, потом HTML текст. Рендерится через `dangerouslySetInnerHTML` в LessonClient.tsx.

**Miniapp auth:** Supabase email/password + localStorage сессия. Telegram WebView сохраняет localStorage между открытиями.

**block6.svg (7 Благословений):** файл меньше других (7KB vs 21–37KB) — возможно, не хватает последнего благословения (Цель от Бога / Мф 28:18-20). Проверить визуально.

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
2. Задеплоить `apps/miniapp/` на Vercel (отдельный проект, Root Directory = `apps/miniapp`)
3. Получить URL miniapp → прописать в BotFather
4. Обновить `approve/route.ts` — добавить кнопку Web App в Telegram-уведомление
5. Протестировать полный flow: студент в Telegram → видео → форум → лидер одобряет → студент получает сообщение с кнопкой → открывает miniapp
