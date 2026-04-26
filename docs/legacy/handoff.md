# Session Handoff — КРЕСТ
> Дата: 2026-04-25 | Фазы 0–8 завершены

---

## Статус платформы

| Компонент | Статус | URL |
|-----------|--------|-----|
| Web App (Next.js) | ✅ Задеплоен | https://krest-platform-web.vercel.app |
| Telegram Mini App | ✅ Задеплоен | https://krest-platform-web.vercel.app/miniapp/index.html |
| Telegram Bot Webhook | ✅ Зарегистрирован | /api/telegram/webhook |
| Supabase | ✅ Подключён | aejhlmoydnhgedgfndql |
| GitHub | ✅ | github.com/Mikhail7000/krest-platform |
| Vercel Auto-deploy | ✅ | GitHub Actions → Deploy Hook при пуше в main |

---

## Telegram Mini App — полная структура

**URL:** `https://krest-platform-web.vercel.app/miniapp/index.html`  
**Расположение в репо:** `apps/web/public/miniapp/`  
**Деплой:** автоматически вместе с основным web приложением (Next.js static files)

### Экраны

| Файл | Экран | Описание |
|------|-------|----------|
| `index.html` | Дашборд студента | Логин + 6 блоков со статусами, прогресс-бар |
| `lesson.html` | Урок | YouTube no-skip → форум (20+ символов) → конспект с SVG |
| `trainer.html` | Тренажёр стихов | Флэш-карточки: reference → reveal → "Знаю" / "Ещё раз" |
| `profile.html` | Профиль | Статы, язык RU/EN, Telegram статус, выход |
| `admin.html` | Лидер | Ожидающие одобрения + все студенты, одобрение одним тапом |

### Навигация
- **Нижняя вкладка** (tab bar): Блоки / Тренажёр / Профиль — на всех студенческих экранах
- **Back button** Telegram — на lesson.html, trainer.html, profile.html, admin.html

### JS/CSS файлы
| Файл | Роль |
|------|------|
| `js/config.js` | Supabase init, Telegram WebApp.ready(), i18n (T.ru) |
| `js/auth.js` | requireAuth(), requireAdmin(), toast(), showLoading() |
| `css/styles.css` | Telegram CSS vars, Apple UI, tab bar, cards, toasts |

---

## Telegram Bot — настройка

**Bot Token:** `8348590676:AAFc2U8sAZTEAHq_xFFbi0cQEoTeugDkx70`

| Что | Статус | Как настроено |
|-----|--------|---------------|
| Menu button (✝️ КРЕСТ) | ✅ | Bot API `setChatMenuButton` |
| Webhook | ✅ | `https://krest-platform-web.vercel.app/api/telegram/webhook` |
| Команды | ✅ | /start, /progress, /help |

### Как студент подключает Telegram:
1. Открывает бота → /start
2. Вводит `/start email@example.com` — бот находит профиль и сохраняет `telegram_chat_id`
3. После этого получает уведомления при одобрении блоков

---

## Backend API Routes

| Route | Метод | Назначение |
|-------|-------|-----------|
| `/api/admin/approve` | POST | Одобрение блока + Telegram студенту с кнопкой Mini App |
| `/api/auth/logout` | POST | Выход |
| `/api/student/journal` | POST | Сохранение форума + Telegram уведомление лидеру |
| `/api/telegram/webhook` | POST | Бот: /start → сохранение telegram_chat_id в profiles |

---

## Web App — структура (apps/web/src/)

```
app/
  admin/
    page.tsx                    → список студентов
    students/[userId]/
      page.tsx                  → детали студента
      ApproveButton.tsx         → кнопка одобрения
  api/
    admin/approve/route.ts      → POST: одобрить блок
    auth/logout/route.ts        → POST: выход
    student/journal/route.ts    → POST: сохранить форум + notify leader
    telegram/webhook/route.ts   → POST: Telegram bot updates
  student/
    page.tsx                    → дашборд студента
    lesson/[blockId]/
      page.tsx                  → страница урока
      LessonClient.tsx          → YouTube + форум + конспект
  login/page.tsx
  layout.tsx, globals.css
hooks/use-youtube-no-skip.ts
lib/supabase-browser.ts, supabase-server.ts
middleware.ts
public/
  content/block1–6.svg         → SVG конспекты блоков
  miniapp/                     → Telegram Mini App (статические файлы)
```

---

## Важные технические заметки

**SVG конспекты:** `blocks.content_ru` начинается с `<img src="/content/blockN.svg">` + HTML текст. Рендер через `dangerouslySetInnerHTML` в LessonClient.tsx.

**TypeScript workaround:** `apps/web/src/lib/supabase-server.ts` — локальный server client с прямым импортом типов (из-за generic boundary в Turborepo).

**Miniapp auth:** Supabase email/password + localStorage сессия. Telegram WebView сохраняет localStorage между открытиями.

**SUPABASE_SERVICE_ROLE_KEY:** Текущее значение `sb_publishable_...` — это publishable key, НЕ service role. Для webhook route (запись telegram_chat_id без RLS) нужен настоящий service role key (`eyJ...`). Взять в Supabase Dashboard → Project Settings → API → service_role.

**block6.svg:** файл меньше других (7KB vs 21–37KB) — возможно, не хватает 7-го благословения (Цель от Бога / Мф 28:18-20). Проверить визуально.

---

## ENV переменные (.env.local — не коммитить!)

```
NEXT_PUBLIC_SUPABASE_URL=https://aejhlmoydnhgedgfndql.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=sb_publishable_...  ← НУЖНО ЗАМЕНИТЬ на настоящий service_role JWT
TELEGRAM_BOT_TOKEN=8348590676:AAFc2U8sAZTEAHq_xFFbi0cQEoTeugDkx70
TELEGRAM_LEADER_CHAT_ID=255214568
NEXT_PUBLIC_APP_URL=https://krest.vercel.app
```

---

## Следующие шаги (приоритет)

1. **Исправить SUPABASE_SERVICE_ROLE_KEY** в Vercel ENV — взять настоящий JWT из Supabase Dashboard. Без этого webhook не может записать telegram_chat_id.
2. **Добавить bible_verses в Supabase** — тренажёр уже готов, но данные нужно вставить (INSERT в таблицу bible_verses для каждого блока)
3. **Протестировать полный flow:**
   - Студент открывает бота → /start → вводит email
   - Студент проходит урок в Mini App: видео → форум → конспект
   - Лидер получает Telegram уведомление → одобряет → студент получает уведомление с кнопкой
4. **Добавить новые разделы** легко через шаблон: создать `newpage.html` по образцу `trainer.html`, добавить вкладку в tab bar CSS

---

## Как добавить новый экран в Mini App

1. Скопировать `trainer.html` как шаблон
2. Обновить `<title>` и логику `init()`
3. Добавить tab в `css/styles.css` `.tab-bar-nav` если нужна новая вкладка
4. Закоммитить — Vercel задеплоит автоматически
