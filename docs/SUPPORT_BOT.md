# Support Bot (@cross_notify_bot)

## Зачем это нужно КРЕСТ

@cross_notify_bot уже отправляет уведомления студентам. Расширяем функционал:
- Студент может узнать свой прогресс через команды
- Лидер может отправить сообщение всем студентам
- Бот отвечает на вопросы и помогает с навигацией

Это снижает нагрузку на лидера: студент сам проверяет статус вместо личных сообщений.

## Архитектурная схема

```
+------------------+     +---------------------+     +------------------+
|    Telegram      |     |   Vercel Edge Fn    |     |    Supabase      |
|                  |     |                     |     |                  |
|  Студент:        | --> |  api/telegram-      | --> |  profiles        |
|  /start          |     |  webhook.js         |     |  (telegram_chat_ |
|  /status         |     |                     |     |   id)            |
|  /myblock        |     |  Роутинг команд:    |     |                  |
|                  |     |  handleStart()      |     |  student_progress|
|  Лидер:          |     |  handleStatus()     |     |  (admin_approved)|
|  /broadcast      |     |  handleBroadcast()  |     |                  |
|  /pending        |     |                     |     |  blocks          |
+------------------+     +---------------------+     +------------------+
        ^                         |
        |     sendMessage()       |
        +-------------------------+
```

## Что умеет бот сейчас

| Функция | Статус | Описание |
|---------|--------|----------|
| sendMessage | ✅ | Уведомление о одобрении блока |
| profiles.telegram_chat_id | ✅ | Хранение связи user ↔ Telegram |

Текущая отправка уведомлений (без webhook, из admin JS):

```javascript
// admin/students.html — после одобрения блока
async function notifyStudent(chatId, message) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    })
  });
}
```

## Команды для добавления

### Студенческие команды

| Команда | Описание |
|---------|----------|
| /start | Регистрация chat_id, приветствие |
| /help | Список доступных команд |
| /status | Текущий блок и статус одобрения |
| /myblock | Ссылка на текущий урок |

### Команды лидера

| Команда | Описание |
|---------|----------|
| /broadcast текст | Отправить сообщение всем студентам |
| /pending | Список студентов, ожидающих одобрения |

## Реализация: api/telegram-webhook.js

```javascript
// api/telegram-webhook.js

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const WEB_URL = 'https://krest.vercel.app';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  // Проверить секретный токен в header
  const secretHeader = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (secretHeader !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const update = await req.json();
  
  if (!update.message?.text) {
    return new Response('OK', { status: 200 });
  }

  const chatId = update.message.chat.id;
  const text = update.message.text;
  const userId = update.message.from.id;

  // Роутинг команд
  if (text.startsWith('/start')) {
    await handleStart(chatId, userId, update.message.from);
  } else if (text === '/help') {
    await handleHelp(chatId);
  } else if (text === '/status') {
    await handleStatus(chatId);
  } else if (text === '/myblock') {
    await handleMyBlock(chatId);
  } else if (text.startsWith('/broadcast ')) {
    await handleBroadcast(chatId, text.slice(11));
  } else if (text === '/pending') {
    await handlePending(chatId);
  }

  return new Response('OK', { status: 200 });
}

// ============ СТУДЕНЧЕСКИЕ КОМАНДЫ ============

async function handleStart(chatId, telegramId, from) {
  // Найти профиль по email (студент должен быть зарегистрирован в КРЕСТ)
  // Вариант 1: попросить ввести email
  // Вариант 2: использовать deep link с user_id
  
  const welcomeText = `
Добро пожаловать в КРЕСТ!

Чтобы привязать Telegram к вашему аккаунту:
1. Войдите в ${WEB_URL}/login.html
2. В профиле нажмите "Привязать Telegram"
3. Введите код: <code>${telegramId}</code>

После привязки вы будете получать уведомления и сможете использовать команды.

/help — список команд
  `;
  
  await sendMessage(chatId, welcomeText);
}

async function handleHelp(chatId) {
  const helpText = `
<b>Команды КРЕСТ:</b>

/status — ваш текущий прогресс
/myblock — ссылка на текущий урок
/help — эта справка

<b>Поддержка:</b>
Напишите любое сообщение — лидер получит уведомление.
  `;
  
  await sendMessage(chatId, helpText);
}

async function handleStatus(chatId) {
  // Найти профиль по telegram_chat_id
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*, blocks_unlocked')
    .eq('telegram_chat_id', chatId)
    .single();
  
  if (error || !profile) {
    await sendMessage(chatId, 'Ваш Telegram не привязан к аккаунту КРЕСТ. Используйте /start для инструкций.');
    return;
  }
  
  // Найти последний прогресс
  const { data: progress } = await supabase
    .from('student_progress')
    .select('*, block:blocks(title_ru, order_num)')
    .eq('user_id', profile.user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  let statusText = `<b>Ваш прогресс:</b>\n\n`;
  statusText += `Доступно блоков: ${profile.blocks_unlocked} из 6\n`;
  
  if (progress) {
    const approved = progress.admin_approved ? '✅ Одобрен' : '⏳ Ожидает проверки';
    statusText += `\nПоследний блок: ${progress.block.title_ru}\n`;
    statusText += `Статус: ${approved}`;
  } else {
    statusText += '\nВы еще не начали обучение.';
  }
  
  await sendMessage(chatId, statusText);
}

async function handleMyBlock(chatId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('blocks_unlocked')
    .eq('telegram_chat_id', chatId)
    .single();
  
  if (!profile) {
    await sendMessage(chatId, 'Telegram не привязан. /start для инструкций.');
    return;
  }
  
  // Найти текущий блок
  const { data: block } = await supabase
    .from('blocks')
    .select('id, title_ru')
    .eq('order_num', profile.blocks_unlocked)
    .single();
  
  if (!block) {
    await sendMessage(chatId, 'Вы прошли все блоки! Поздравляем!');
    return;
  }
  
  const url = `${WEB_URL}/student/lesson.html?block=${block.id}`;
  await sendMessage(chatId, `
<b>Ваш текущий блок:</b> ${block.title_ru}

<a href="${url}">Открыть урок</a>
  `);
}

// ============ КОМАНДЫ ЛИДЕРА ============

async function handleBroadcast(chatId, message) {
  // Проверить что отправитель — лидер
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('telegram_chat_id', chatId)
    .single();
  
  if (!profile || profile.role !== 'admin') {
    await sendMessage(chatId, 'Эта команда доступна только лидерам.');
    return;
  }
  
  // Получить всех студентов с telegram_chat_id
  const { data: students } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .not('telegram_chat_id', 'is', null)
    .eq('role', 'student');
  
  if (!students || students.length === 0) {
    await sendMessage(chatId, 'Нет студентов с привязанным Telegram.');
    return;
  }
  
  // Отправить сообщение каждому
  let sent = 0;
  for (const student of students) {
    try {
      await sendMessage(student.telegram_chat_id, `<b>Сообщение от лидера:</b>\n\n${message}`);
      sent++;
    } catch (e) {
      console.error(`Failed to send to ${student.telegram_chat_id}:`, e);
    }
  }
  
  await sendMessage(chatId, `Сообщение отправлено ${sent} студентам.`);
}

async function handlePending(chatId) {
  // Проверить что отправитель — лидер
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('telegram_chat_id', chatId)
    .single();
  
  if (!profile || profile.role !== 'admin') {
    await sendMessage(chatId, 'Эта команда доступна только лидерам.');
    return;
  }
  
  // Найти неодобренные записи
  const { data: pending } = await supabase
    .from('student_progress')
    .select(`
      *,
      profile:profiles(name, email),
      block:blocks(title_ru)
    `)
    .eq('admin_approved', false)
    .order('created_at', { ascending: true });
  
  if (!pending || pending.length === 0) {
    await sendMessage(chatId, 'Нет студентов, ожидающих одобрения.');
    return;
  }
  
  let text = `<b>Ожидают одобрения (${pending.length}):</b>\n\n`;
  for (const p of pending) {
    text += `• ${p.profile.name} — ${p.block.title_ru}\n`;
  }
  text += `\n<a href="${WEB_URL}/admin/students.html">Открыть панель</a>`;
  
  await sendMessage(chatId, text);
}

// ============ УТИЛИТЫ ============

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });
}
```

## Настройка Webhook в Telegram

```bash
# Установить webhook (выполнить один раз)
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://krest.vercel.app/api/telegram-webhook",
    "secret_token": "your-webhook-secret"
  }'

# Проверить webhook
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

## Почему нужен сервер/webhook

| Сценарий | Без webhook | С webhook |
|----------|-------------|-----------|
| Отправить уведомление | Работает (fetch из браузера) | Работает |
| Получить команду /status | НЕ работает | Работает |
| Ответить на сообщение | НЕ работает | Работает |

Telegram отправляет обновления (команды, сообщения) через webhook на наш сервер. Без сервера бот может только отправлять, но не получать.

## ENV переменные

```env
# Vercel Environment Variables

TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_WEBHOOK_SECRET=random-string-for-security
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Безопасность

| Правило | Реализация |
|---------|------------|
| Проверять webhook secret | X-Telegram-Bot-Api-Secret-Token header |
| Проверять роль для /broadcast | profile.role === 'admin' |
| Не показывать данные других студентов | Фильтр по telegram_chat_id |
| service_role только на сервере | Edge Function, не браузер |

## Текущий статус

| Компонент | Статус |
|-----------|--------|
| @cross_notify_bot создан | ✅ |
| profiles.telegram_chat_id | ✅ |
| Отправка уведомлений (sendMessage) | ✅ |
| api/telegram-webhook.js | ⏳ Планируется |
| /start команда | ⏳ Планируется |
| /status команда | ⏳ Планируется |
| /myblock команда | ⏳ Планируется |
| /broadcast команда | ⏳ Планируется |
| /pending команда | ⏳ Планируется |
| Привязка Telegram в профиле | ⏳ Планируется |

## Дальнейшее развитие

1. **Inline-кнопки** — вместо текстовых команд
2. **Callback queries** — интерактивное одобрение блоков прямо в Telegram
3. **Напоминания** — если студент не заходил N дней
4. **Чат поддержки** — пересылка сообщений лидеру
