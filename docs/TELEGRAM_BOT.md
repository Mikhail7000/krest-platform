# TELEGRAM_BOT.md — Уведомления через Telegram

> Архитектура Telegram-уведомлений платформы КРЕСТ.

---

## Бот

**@cross_notify_bot** — создан через @BotFather.

Токен хранится в `js/config.js` как константа (не в .env, т.к. Vanilla JS без сервера).

```javascript
// js/config.js
const TELEGRAM_BOT_TOKEN = 'YOUR_BOT_TOKEN';
const TELEGRAM_LEADER_CHAT = 123456789; // chat_id лидера (Михаил)
```

---

## Архитектура уведомлений

```
СТУДЕНТ → submitForum()
              ↓
        sendTelegramMsg(TELEGRAM_LEADER_CHAT, "📩 студент отправил ответ")
              ↓
        ЛИДЕР получает сообщение в Telegram

ЛИДЕР → approveBlock()
              ↓
        если profile.telegram_chat_id существует:
        sendTelegramMsg(studentChatId, "✅ блок одобрен!")
              ↓
        СТУДЕНТ получает сообщение в Telegram
```

---

## Функция отправки (js/auth.js)

```javascript
async function sendTelegramMsg(chatId, text) {
  if (!chatId || !TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      }),
    });
  } catch (_) {
    // Telegram недоступен — не критично, не блокировать основной flow
  }
}
```

**Ключевые решения:**
- `try/catch` без toast — ошибка Telegram не должна мешать студенту
- `parse_mode: 'HTML'` — поддержка `<b>`, `<i>` в сообщениях
- Вызов async без await там где уведомление некритично

---

## Шаблоны сообщений

### Студент отправил форум (лидеру)

```javascript
sendTelegramMsg(
  TELEGRAM_LEADER_CHAT,
  `📩 <b>${profile.full_name}</b> отправил ответ по блоку «${blockTitle}»\n\n${text.slice(0, 300)}`
);
```

### Блок одобрён (студенту)

```javascript
if (studentProfile.telegram_chat_id) {
  sendTelegramMsg(
    studentProfile.telegram_chat_id,
    `✅ Блок «${blockTitle}» одобрен!\n\nСледующий блок теперь доступен.`
  );
}
```

---

## Привязка Telegram для студентов

### Как студент получает chat_id

1. Студент пишет `/start` боту `@cross_notify_bot`
2. Бот отвечает его chat_id
3. Студент копирует chat_id в профиль на платформе

### Форма в профиле студента

```html
<div class="settings-section">
  <label>Telegram Chat ID</label>
  <input type="number" id="telegram-chat-id" placeholder="Ваш Chat ID">
  <small>Напишите /start боту @cross_notify_bot чтобы узнать ваш ID</small>
  <button onclick="saveTelegramId()">Сохранить</button>
</div>
```

```javascript
async function saveTelegramId() {
  const chatId = parseInt(document.getElementById('telegram-chat-id').value);
  if (!chatId) { toast(t.invalid_chat_id, 'error'); return; }

  const { error } = await _supabase
    .from('profiles')
    .update({ telegram_chat_id: chatId })
    .eq('id', user.id);

  if (error) { toast(t.error_save, 'error'); return; }

  // Тест — отправить приветственное сообщение
  await sendTelegramMsg(chatId, '✅ Telegram успешно привязан к платформе КРЕСТ!');
  toast(t.telegram_linked, 'success');
}
```

---

## Почему прямой fetch, а не бэкенд

Платформа КРЕСТ — Vanilla JS без сервера. Telegram Bot API поддерживает CORS для POST запросов из браузера. Токен бота в config.js — допустимо, т.к.:
- Бот только ОТПРАВЛЯЕТ сообщения (sendMessage)
- Бот не читает сообщения пользователей через этот токен (getUpdates не используется)
- Компрометация токена позволяет только отправлять сообщения от имени бота — не получать данные пользователей

Если нужен webhook (бот принимает команды) — потребуется сервер или Vercel Edge Function.

---

## Текущий статус

- ✅ Бот создан: @cross_notify_bot
- ✅ Функция sendTelegramMsg в auth.js
- ✅ Уведомление лидеру при отправке форума
- ✅ Уведомление студенту при одобрении (если chat_id привязан)
- ⏳ UI для привязки telegram_chat_id в профиле студента
- ⏳ Команда /start для бота (потребует сервер/webhook)
