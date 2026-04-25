# GetCourse Integration

## Зачем это нужно КРЕСТ

GetCourse — российская платформа онлайн-образования с приемом оплат (карты, ЮKassa, Tinkoff). Вместо своей платежной системы КРЕСТ использует GetCourse:

- Студент платит на GetCourse
- Webhook создает аккаунт в КРЕСТ
- Студент получает email со ссылкой и паролем

Мы НЕ храним платежные данные. GetCourse управляет оплатами, мы управляем обучением.

## Архитектурная схема

```
+------------------+     +---------------------+     +------------------+
|    GetCourse     |     |   Vercel Edge Fn    |     |    Supabase      |
|                  |     |                     |     |                  |
|  Оплата курса    | --> |  api/getcourse-     | --> |  auth.users      |
|  "КРЕСТ"         |     |  webhook.js         |     |  (создать user)  |
|                  |     |                     |     |                  |
|  Webhook:        |     |  1. Проверить hash  |     |  profiles        |
|  POST /api/...   |     |  2. Создать user    |     |  (создать profile|
|                  |     |  3. Отправить email |     |   blocks_unlocked|
+------------------+     +---------------------+     |   = 1)           |
                                                     +------------------+
```

## Flow регистрации

```
1. Студент оплачивает курс "КРЕСТ" на GetCourse
                    |
                    v
2. GetCourse отправляет POST webhook на наш endpoint
   https://krest.vercel.app/api/getcourse-webhook
                    |
                    v
3. Edge Function проверяет подпись (GETCOURSE_WEBHOOK_SECRET)
                    |
                    v
4. Создаем пользователя в Supabase Auth (service_role)
   + профиль с blocks_unlocked = 1
                    |
                    v
5. Отправляем email студенту:
   "Добро пожаловать в КРЕСТ! Ваш логин: email, пароль: temp123"
   + ссылка на вход
```

## Webhook payload от GetCourse

GetCourse отправляет данные в формате form-urlencoded или JSON:

```json
{
  "action": "payment_success",
  "user": {
    "email": "student@example.com",
    "name": "Иван Петров",
    "phone": "+79001234567"
  },
  "deal": {
    "id": 12345,
    "product_title": "КРЕСТ - Курс ученичества",
    "cost": 3000,
    "currency": "RUB"
  },
  "hash": "abc123def456..."
}
```

## Edge Function: api/getcourse-webhook.js

```javascript
// api/getcourse-webhook.js

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Только на сервере!
);

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.json();
  
  // 1. Проверить подпись GetCourse
  if (!verifyGetCourseHash(body)) {
    console.error('Invalid GetCourse hash');
    return new Response('Unauthorized', { status: 401 });
  }
  
  // 2. Проверить что это оплата курса КРЕСТ
  if (body.action !== 'payment_success') {
    return new Response('Ignored', { status: 200 });
  }
  
  const email = body.user.email;
  const name = body.user.name || 'Студент';
  
  // 3. Проверить существует ли пользователь
  const { data: existingUser } = await supabase.auth.admin.listUsers();
  const userExists = existingUser.users.some(u => u.email === email);
  
  if (userExists) {
    console.log(`User ${email} already exists`);
    return new Response('User exists', { status: 200 });
  }
  
  // 4. Создать временный пароль
  const tempPassword = generateTempPassword();
  
  // 5. Создать пользователя в Supabase Auth
  const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true, // Автоматически подтвердить email
    user_metadata: { name, source: 'getcourse' }
  });
  
  if (authError) {
    console.error('Auth error:', authError);
    return new Response('Auth error', { status: 500 });
  }
  
  // 6. Создать профиль
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      user_id: newUser.user.id,
      email,
      name,
      role: 'student',
      blocks_unlocked: 1,
      created_at: new Date().toISOString()
    });
  
  if (profileError) {
    console.error('Profile error:', profileError);
    // Удалить auth user если профиль не создался
    await supabase.auth.admin.deleteUser(newUser.user.id);
    return new Response('Profile error', { status: 500 });
  }
  
  // 7. Отправить email студенту
  await sendWelcomeEmail(email, name, tempPassword);
  
  console.log(`Created user: ${email}`);
  return new Response('OK', { status: 200 });
}

function verifyGetCourseHash(body) {
  const secret = process.env.GETCOURSE_WEBHOOK_SECRET;
  // GetCourse использует свой формат подписи — проверить документацию
  const dataString = `${body.user.email}${body.deal.id}${secret}`;
  const hash = crypto.createHash('md5').update(dataString).digest('hex');
  return hash === body.hash;
}

function generateTempPassword() {
  return crypto.randomBytes(8).toString('hex'); // 16 символов
}

async function sendWelcomeEmail(email, name, password) {
  // Использовать Supabase email или внешний сервис (Resend, SendGrid)
  // Пример с Resend:
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'КРЕСТ <noreply@krest.app>',
      to: email,
      subject: 'Добро пожаловать в КРЕСТ!',
      html: `
        <h1>Привет, ${name}!</h1>
        <p>Ваш аккаунт в платформе КРЕСТ создан.</p>
        <p><strong>Логин:</strong> ${email}</p>
        <p><strong>Временный пароль:</strong> ${password}</p>
        <p><a href="https://krest.vercel.app/login.html">Войти в КРЕСТ</a></p>
        <p>Рекомендуем сменить пароль после первого входа.</p>
      `
    })
  });
}
```

## Настройка webhook в GetCourse

1. Зайти в GetCourse → Настройки → Интеграции → Webhooks
2. Добавить webhook:
   - URL: `https://krest.vercel.app/api/getcourse-webhook`
   - События: "Успешная оплата"
   - Продукт: "КРЕСТ - Курс ученичества"
3. Скопировать секретный ключ в Vercel ENV

## ENV переменные

```env
# Vercel Environment Variables (Settings → Environment Variables)

GETCOURSE_WEBHOOK_SECRET=секретный-ключ-из-getcourse
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # ТОЛЬКО серверный ключ, не anon!
RESEND_API_KEY=re_xxx...          # Для отправки email (опционально)
```

## Безопасность

| Правило | Почему |
|---------|--------|
| Проверять hash от GetCourse | Защита от поддельных запросов |
| service_role только на сервере | В браузере — только anon key |
| Не хранить платежные данные | PCI DSS compliance |
| email_confirm: true | Не требовать подтверждения email (GetCourse уже проверил) |
| Временный пароль | Студент должен сменить при первом входе |

## Текущий статус

| Компонент | Статус |
|-----------|--------|
| Архитектура | ✅ Документирована |
| GetCourse продукт | ⏳ Создать на GetCourse |
| api/getcourse-webhook.js | ⏳ Планируется |
| Email шаблон | ⏳ Планируется |
| Тестирование webhook | ⏳ Планируется |

## Что НЕ нужно делать

- НЕ хранить номер карты, CVV, платежные данные
- НЕ создавать свою платежную страницу
- НЕ дублировать данные о покупке (только user_metadata.source)
- НЕ использовать service_role key в браузерном коде

## Альтернативы GetCourse

Если нужно заменить GetCourse:
- Tildapay — аналогичный webhook flow
- Stripe — международные платежи, свой webhook формат
- Robokassa — российские платежи

Архитектура остается той же: webhook → Edge Function → Supabase.
