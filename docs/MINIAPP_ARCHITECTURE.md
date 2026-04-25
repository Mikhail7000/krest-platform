# Telegram Mini App Architecture

## Зачем это нужно КРЕСТ

Telegram Mini App — параллельный канал доступа к курсу. Студент нажимает кнопку в @cross_notify_bot и проходит урок прямо в Telegram без перехода в браузер. Это снижает трение: уведомление пришло → одно нажатие → урок открылся.

Web-версия и Mini App используют одну базу Supabase. Прогресс синхронизирован.

## Архитектурная схема

```
+------------------+     +---------------------+     +------------------+
|  Telegram App    |     |  Mini App (WebView) |     |    Supabase      |
|                  |     |                     |     |                  |
|  @cross_notify   | --> |  miniapp/index.html | --> |  profiles        |
|  bot             |     |  miniapp/lesson.html|     |  blocks          |
|                  |     |                     |     |  student_progress|
|  [Открыть курс]  |     |  JS + Supabase SDK  |     |  journal_entries |
+------------------+     +---------------------+     +------------------+
        |                         |
        |    initData             |  telegram_chat_id
        +------------------------>+  = user mapping
```

## Аутентификация через Telegram initData

Telegram передает данные пользователя в Mini App через `window.Telegram.WebApp.initData`. Это строка с hash-подписью от Telegram.

### Получение данных пользователя

```javascript
// miniapp/js/telegram-auth.js

const tg = window.Telegram.WebApp;
tg.ready();

// Данные пользователя (без проверки — только для отображения)
const user = tg.initDataUnsafe?.user;
// { id: 123456789, first_name: "Михаил", username: "mikhail" }

// Для безопасных операций — отправить initData на сервер для проверки
const initData = tg.initData; // "query_id=AAHd...&user=...&hash=abc123"
```

### Проверка initData на сервере (Vercel Edge Function)

```javascript
// api/telegram-verify.js

import crypto from 'crypto';

export default async function handler(req, res) {
  const { initData } = req.body;
  
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');
  
  // Сортировка параметров
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  
  // Проверка подписи
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();
  
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  if (calculatedHash !== hash) {
    return res.status(401).json({ error: 'Invalid hash' });
  }
  
  const user = JSON.parse(params.get('user'));
  return res.json({ telegram_id: user.id, valid: true });
}
```

## Соответствие Telegram user_id и Supabase auth

Mini App не использует email/password. Связь через `profiles.telegram_chat_id`:

```javascript
// Найти профиль по Telegram ID
const { data: profile } = await _supabase
  .from('profiles')
  .select('*, auth_user:user_id(*)')
  .eq('telegram_chat_id', telegramUserId)
  .single();

if (!profile) {
  // Пользователь не привязал Telegram — показать инструкцию
  showLinkAccountScreen();
  return;
}

// Для запросов к Supabase с RLS нужен JWT
// Вариант 1: Custom JWT через Edge Function
// Вариант 2: Magic link на email (менее удобно для Mini App)
```

### Custom JWT для Mini App (рекомендуется)

```javascript
// api/miniapp-auth.js — выдача JWT после проверки initData

import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // После проверки initData (см. выше)
  const telegramId = verified.telegram_id;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('telegram_chat_id', telegramId)
    .single();
  
  if (!profile) {
    return res.status(404).json({ error: 'Account not linked' });
  }
  
  // Создать JWT для Supabase
  const token = jwt.sign(
    { sub: profile.user_id, role: 'authenticated' },
    process.env.SUPABASE_JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  return res.json({ access_token: token });
}
```

## Навигация Mini App

Тот же 7-шаговый flow, адаптированный UI:

```
miniapp/index.html          — Список блоков (карточки)
       |
       v
miniapp/lesson.html?b=1     — Урок блока 1
       |
       +-- Видео (YouTube IFrame, no-skip)
       +-- Форум (textarea, 20+ символов)
       +-- Конспект (после отправки)
       +-- Кнопка "Следующий" (после admin_approved)
```

### Пример: список блоков

```javascript
// miniapp/js/blocks.js

async function loadBlocks() {
  const { data: blocks } = await _supabase
    .from('blocks')
    .select('*')
    .order('order_num');
  
  const { data: profile } = await _supabase
    .from('profiles')
    .select('blocks_unlocked')
    .eq('user_id', currentUserId)
    .single();
  
  const container = document.getElementById('blocks');
  blocks.forEach(block => {
    const locked = block.order_num > profile.blocks_unlocked;
    container.innerHTML += `
      <div class="block-card ${locked ? 'locked' : ''}" 
           onclick="${locked ? '' : `openLesson(${block.id})`}">
        <span class="block-num">${block.order_num}</span>
        <span class="block-title">${block.title_ru}</span>
        ${locked ? '<span class="lock-icon">locked</span>' : ''}
      </div>
    `;
  });
}
```

## Что общего с web-версией

| Компонент | Общий |
|-----------|-------|
| Supabase queries | Идентичны |
| RLS политики | Те же |
| YouTube no-skip логика | Та же |
| 7-шаговый flow | Тот же |
| js/config.js (Supabase init) | Можно переиспользовать |

## Что отличается

| Компонент | Web | Mini App |
|-----------|-----|----------|
| Navbar | renderNav() в #topnav | Нет — Telegram header |
| Auth | email/password | Telegram initData + JWT |
| Навигация | URL routing | Telegram WebApp.BackButton |
| Отступы | desktop-first | mobile padding (16px) |
| Кнопки | CSS buttons | Telegram MainButton API |

### Telegram UI компоненты

```javascript
const tg = window.Telegram.WebApp;

// Главная кнопка внизу экрана
tg.MainButton.setText('Продолжить');
tg.MainButton.show();
tg.MainButton.onClick(() => submitForum());

// Кнопка "Назад"
tg.BackButton.show();
tg.BackButton.onClick(() => goToBlockList());

// Закрыть Mini App
tg.close();

// Тема (темная/светлая)
const isDark = tg.colorScheme === 'dark';
document.body.classList.toggle('dark', isDark);
```

## Файловая структура

```
miniapp/
  index.html         — Список блоков
  lesson.html        — Урок (видео + форум + конспект)
  css/
    miniapp.css      — Мобильные стили, Telegram theme variables
  js/
    telegram-auth.js — Инициализация Telegram WebApp, получение JWT
    blocks.js        — Список блоков
    lesson.js        — Логика урока (копия из student/lesson.html, адаптированная)
```

## Текущий статус

| Компонент | Статус |
|-----------|--------|
| Архитектура | ✅ Документирована |
| profiles.telegram_chat_id | ✅ Поле существует |
| miniapp/index.html | ⏳ Планируется |
| miniapp/lesson.html | ⏳ Планируется |
| api/telegram-verify.js | ⏳ Планируется |
| api/miniapp-auth.js | ⏳ Планируется |
| Telegram Bot Menu Button | ⏳ Планируется |

## ENV переменные

```env
# Уже есть (для уведомлений)
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...

# Нужно добавить (для JWT)
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase-dashboard
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Только в Vercel, не в браузере!
```

## Безопасность

1. **Никогда не доверять initDataUnsafe без проверки hash** — использовать только для отображения имени
2. **Проверка initData только на сервере** — TELEGRAM_BOT_TOKEN не должен быть в браузере
3. **JWT с коротким сроком жизни** — 1 час максимум
4. **RLS работает так же** — JWT содержит user_id, Supabase проверяет права
