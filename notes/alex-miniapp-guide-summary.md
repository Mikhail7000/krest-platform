# Алекс Магнье: гид Telegram MiniApp — выжимка для КРЕСТ

> Источник: `/Users/rogue/Desktop/AI ALEX COURSE MATERIALS /УРОК 18 - Telegram MiniApp/telegram-miniapp-build-guide.md` (1331 строка)
> Извлечено: 2026-05-01

## Главные правила (что не нарушать)

- **SDK** — голый `telegram-web-app.js` через `next/script` с `strategy="beforeInteractive"`, БЕЗ сторонних обёрток (`@twa-dev/sdk`, `@telegram-apps/sdk` — Алекс их не использует)
- **TS типы** — cast `as unknown as { Telegram?: { WebApp: any } }`, без типизации SDK через библиотеку
- **HMAC** — только `timingSafeEqual` (не `===`/`==`), `auth_date` ≤ 8 часов (`maxAgeSeconds = 28800`), при любой ошибке return `null`
- **Server Components** по умолчанию, `'use client'` только где нужен `window.Telegram.WebApp`
- **Tailwind v4** — `@import "tailwindcss"` + `@theme` блок (НЕ `@tailwind base/components/utilities` и НЕ `tailwind.config.ts`)
- **Не использовать** хардкод цветов (`bg-white`, `text-gray-900`) — только `bg-background`, `text-foreground`, `bg-card` через CSS variables
- **Не использовать** `md:`, `lg:`, `xl:`, `2xl:` — только mobile-first
- **Не использовать** sidebar, header, многоколонки — только `max-w-md mx-auto px-4 py-6`
- **MainButton/BackButton** — обязательный `cleanup` в `useEffect` (`button.offClick + button.hide`), иначе зависают на следующей странице

## Архитектура (для нашего PoC)

Алекс рекомендует **отдельный workspace** `apps/miniapp`. Для PoC КРЕСТ используем **route prefix `/m/...`** в существующем `apps/web` — проще, без рефакторинга monorepo.

## CSP в next.config.ts (КРИТИЧНО для Telegram + Kinescope)

```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://kinescope.io https://*.kinescope.io
style-src 'self' 'unsafe-inline' https://kinescope.io https://*.kinescope.io
frame-src https://kinescope.io https://*.kinescope.io https://telegram.org
media-src 'self' blob: https://*.supabase.co https://kinescope.io https://*.kinescope.io
connect-src 'self' https://api.anthropic.com https://*.supabase.co https://kinescope.io https://*.kinescope.io
frame-ancestors https://web.telegram.org https://telegram.org
```

⚠️ **Wildcard `*.example.com` НЕ покрывает apex `example.com`** — нужно оба.

## Telegram theme → Tailwind v4 (мост)

Алекс через JS пишет CSS variables `--tg-bg`, `--tg-text` ... в `:root`, а Tailwind `@theme` мапит их на `--color-background`, `--color-foreground` и т.д. При смене темы в Telegram (event `themeChanged`) вся UI перекрашивается без перезагрузки.

## TelegramProvider — паттерн

Клиентский контекст:
1. Читает `tg.initData`
2. Если нет — показывает «Откройте через Telegram»
3. Делает `tg.ready()`, `tg.expand()`, `applyTelegramTheme()`, `listenThemeChanges()`
4. POST на `/api/auth` с `initData` — получает `profile`
5. Хранит `profile` в React state (НЕ в cookie/localStorage)

**Stateless модель Алекса:** на каждом защищённом запросе клиент шлёт `initData`, сервер каждый раз HMAC-валидирует. У нас сейчас Supabase Auth с cookie-сессиями — это **архитектурный конфликт**, обсудить с Михаилом.

## Видео

- **Kinescope упомянут конкретно** для защиты — signed URL + watermark
- Интеграция через iframe (allow="autoplay; fullscreen; picture-in-picture; encrypted-media")
- **Кастомный no-skip педагогический полл — НЕ описан в гиде.** Оставляем нашу логику (polling 500ms + `seekTo(maxWatched)`).

## iOS WebView грабли

1. `<a download>` с `blob:` URL — блокируется → `Telegram.WebApp.downloadFile`
2. HLS-плеер чернеет при resize → HTML5 fullscreen API на iframe (не CSS-flip)
3. Chunked encoding режет ответы > 10-12 КБ → `Buffer + Content-Length + ReadableStream`
4. Safe area для notch/home-indicator → `env(safe-area-inset-*)`
5. `instanceof Blob` в Server Actions → duck-typing

## Vercel ограничения

- Body Server Actions ≤ 4.5 MB → для больших файлов direct-to-Storage signed URL
- `bodySizeLimit: '5mb'` максимум, выше Vercel режет
- `runtime = 'nodejs'` для маршрутов с `node:crypto` (HMAC)

## Антипаттерны (тут вся 🔴 секция)

- `md:`, `lg:`, `xl:` breakpoints
- Sidebar / header-навигация / многоколоночные layouts
- Хардкод `bg-white`, `text-gray-900`
- `===`/`==` для хэшей
- `NEXT_PUBLIC_*` для секретов
- Доверять `initDataUnsafe` на сервере
- `<a download>` с `blob:` URL
- CSS-flip для fullscreen видео
- Server Action для файлов > 4.5 MB
- Wildcard `*.example.com` без apex `example.com` в CSP
- Pages Router (только App Router)
- Tailwind v3 (только v4)
- Express для бота (только Fastify)

## Архитектурные вопросы для КРЕСТ (обсудить с Михаилом)

1. **Workspace:** route prefix `/m/...` (PoC) vs отдельный `apps/miniapp` workspace (как у Алекса)?
2. **Auth модель:** stateless HMAC на каждом запросе (Алекс) vs текущий Supabase Auth + cookies (КРЕСТ)? Если Supabase Auth остаётся — мост HMAC ↔ Supabase session гид НЕ описывает, разрабатывать самим.
3. **Видео-плеер:** оставляем YouTube no-skip полл или мигрируем на Kinescope? Кастомный no-skip придётся писать поверх Kinescope iframe API.
