# HANDOVER — КРЕСТ

> Дата: **2026-05-28** | Сессия: 🟡 **Русский онбординг работает в testing-phase (язык → страна → город → save). Компоненты `CuratorSelect` и `NameInput` готовы, но НЕ подключены — нужна тёмная тема и активация полного флоу.**

---

## 🎯 Главное (читать первым)

### Текущее состояние онбординга (2026-05-28)

**Что работает в production:**
- `/m/onboarding/page.tsx` — state-машина: `language → country → city → saving → /m/dashboard`
- `LanguageSelect.tsx` — выбор Русский/English (тёмная тема + звёзды)
- `CountrySelect.tsx` — простой список стран с эмодзи-флагами (тёмная тема)
- `CitySelect.tsx` — список городов выбранной страны (тёмная тема)
- `EnglishPlaceholder.tsx` — "Still Cooking" + рандомный NIV стих (для EN ветки)
- `MiniAppGate.tsx` — после `status === 'ready'` делает `POST /api/miniapp/profile`. Если `onboarding_done === false` → редирект на `/m/onboarding`
- `POST /api/miniapp/onboarding` — сохраняет `country_id, city_id, curator_id, onboarding_done=true` через `resolveUserId(initData)`
- `POST /api/miniapp/profile` — возвращает `{ onboarding_done, country_id, city_id, curator_id, full_name }`
- `telegram-auth/route.ts` — НЕ ставит `onboarding_done=true` для новых юзеров (дефолт `false` в БД) ✅

**Что готово, но НЕ подключено:**
- `steps/CuratorSelect.tsx` — **СВЕТЛАЯ ТЕМА** (`bg-white`, `text-gray-900`), не соответствует дизайну. Загружает `profiles WHERE role='curator' AND city_id=Y`, есть fallback "Написать в поддержку" если кураторов нет.
- `steps/NameInput.tsx` — **СВЕТЛАЯ ТЕМА**, предзаполняет именем из Telegram, есть fallback на "Ученик" если пусто.
- `steps/GlobeSelect.tsx` — 3D-глобус `react-globe.gl` (тёмная тема ✅), альтернатива простому `CountrySelect`. Подсвечивает 9 активных стран, автовращение, клик → выбор.

**Почему отключены:** в `page.tsx:11-12` написано «Шаги 'curator' и 'name' убраны на период теста: куратора ещё нет, имя берём из Telegram автоматически».

---

## 📁 Файлы онбординга

```
apps/web/src/app/m/onboarding/
├── page.tsx                  ← state-машина (текущий флоу language→country→city)
├── LanguageSelect.tsx        ← ✅ тёмная тема
├── EnglishPlaceholder.tsx    ← ✅ тёмная тема + NIV стихи
└── steps/
    ├── CountrySelect.tsx     ← ✅ тёмная тема (простой список)
    ├── CitySelect.tsx        ← ✅ тёмная тема
    ├── CuratorSelect.tsx     ← ❌ светлая тема, не подключён
    ├── NameInput.tsx         ← ❌ светлая тема, не подключён
    └── GlobeSelect.tsx       ← ✅ тёмная тема (альтернатива списку)

apps/web/src/app/api/miniapp/
├── onboarding/route.ts       ← POST: сохраняет онбординг
├── profile/route.ts          ← POST: возвращает onboarding_done
└── telegram-auth/route.ts    ← ✅ НЕ ставит onboarding_done

apps/web/src/app/m/_components/
└── MiniAppGate.tsx           ← ✅ проверяет онбординг
```

---

## ✅ ЧТО РАБОТАЕТ В PRODUCTION (общее)

### Ученик (MiniApp)
- Menu Button бота `@cross_notify_bot` → `/m/dashboard`
- Выбор языка → English "Still Cooking" с NIV стихом (рандом из БД)
- Все 10 блоков КРЕСТ доступны для прохождения
- 12-пунктовая модель ДЗ: видео, конспект, квиз, местописания, пересказ, фото креста
- Экзамены: 10 block-gates + mid-exam + final-exam
- Ачивка «Мастер Креста» при завершении курса

### Куратор (MiniApp)
- Список своих студентов с прогрессом по блокам
- Статусы: not_started → video_watching → quiz_passed → locations_passed → block_completed
- Фильтры: All / Pending Submissions / Silent Days
- Просмотр сабмишенов (текст + медиа: фото, видео, аудио)
- Одобрение (approve) → автоматически проверяет block_completed
- Отклонение (reject) с обязательным комментарием (≥10 символов)
- Визуальные индикаторы: красные бэджи pending, дни молчания

### API (Backend)
- 7 endpoints в `/api/curator/*` (students, submissions, notifications)
- `requireCuratorAuth` guard: проверяет curator/admin/super_admin роль
- RLS filtering: куратор видит своих студентов, admin/super_admin видят всех

### Telegram Auth
- HMAC-SHA256 валидация `initData` на `/api/miniapp/telegram-auth`
- Whitelist проверка: username не в `testing_whitelist` → 403 "Доступ запрещен"

---

## 🔄 ЧТО В ПРОЦЕССЕ (TODO на следующую сессию)

### 1. Активация полного русского онбординга (приоритет)

**Что сделать:**
1. Переделать `CuratorSelect.tsx` и `NameInput.tsx` в **тёмную тему + звёздный фон** — стиль такой же, как в `CountrySelect.tsx` / `CitySelect.tsx`:
   - `relative z-10 min-h-screen flex flex-col px-5 py-8`
   - Кнопки: `border border-white/12 bg-white/5 backdrop-blur-sm`
   - Заголовки: `text-white`, подписи: `text-white/55`
   - Анимации входа: `motion.div` + `initial={{opacity:0, y:20}} animate={{opacity:1, y:0}}`
2. Обновить `page.tsx`:
   - Расширить тип `OnboardingStep`: `'language' | 'english' | 'country' | 'city' | 'curator' | 'name' | 'saving'`
   - Добавить state `curatorId` и `fullName`
   - Изменить переходы: `city → curator → name → saving`
   - Передавать `curator_id` и `full_name` в POST `/api/miniapp/onboarding` (API уже их принимает)
   - Расширить `handleBack` для новых шагов
3. **Решить вопрос с globe-селектором:**
   - Либо заменить `CountrySelect` на `GlobeSelect` (более красивый, но требует `react-globe.gl` + `topojson-client` + `world-atlas` — проверить, установлены ли)
   - Либо оставить простой список (надёжнее на старте)
   - Михаил оставил на потом выбор финального варианта

### 2. Notifications UI
- API есть (`/api/curator/notifications`), UI нет
- Sidebar/badge с alert count
- Список read/unread

### 3. Удалить legacy
- `@cross_bot` хардкод в `TelegramProvider.tsx` → `@cross_notify_bot`
- `/api/cron/reset-streaks`, `/api/cron/archive-cohorts` (legacy v2.0)
- Скрипт `lint` всё ещё `next lint` (Next 16 удалил его)

---

## ❌ ЧТО СЛОМАНО / ДОЛГИ

- **Полный русский онбординг** — компоненты есть, но не подключены (testing phase)
- **CuratorSelect/NameInput** — светлая тема, не соответствует дизайну
- **Notifications UI** — только API, нет UI
- **@cross_bot хардкод** в TelegramProvider.tsx
- **Legacy cron-endpoints** — не удалены

---

## 📋 СТРУКТУРА КОДА (общая)

```
apps/web/src/app/
├── /m/
│   ├── onboarding/          ← language → country → city (testing)
│   ├── curator/             ← список + детали + сабмишены
│   ├── dashboard/
│   ├── lesson/[blockId]/    ← 12-пунктовое ДЗ
│   ├── locations/[blockId]/ ← местописания
│   └── _components/         ← MiniAppGate, SupportRequestScreen
│
└── /api/
    ├── /miniapp/            ← telegram-auth, profile, onboarding
    └── /curator/            ← 7 endpoints для админки
```

---

## 🧠 КЛЮЧЕВЫЕ РЕШЕНИЯ

| Решение | Почему |
|---|---|
| Testing phase онбординга | Куратора ещё нет, имя берём из Telegram |
| Тёмная тема всегда | Игнорируем светлую тему Telegram (см. memory `project_dark_theme_starfield`) |
| Звёздный canvas-фон | Box-shadow ломался в Telegram WebView (см. memory) |
| GlobeSelect готов | Подготовлен альтернативный 3D-вариант (memory `project_globe_country_picker`) |
| API через `resolveUserId(initData)` | Не cookie-based, как в curator API. Совместимо с MiniApp |

---

## 💡 ВАЖНЫЕ ЧИСЛА

- **9 стран** в БД (RU, ID, TH, AE, GE, IL, BY, US, VN)
- **21 город РФ + 9 за рубежом**, активен только Бали
- **Telegram whitelist**: 1 юзер (@Rogue02 / Михаил)
- **10 блоков КРЕСТ**: полный цикл
- **7 API endpoints куратора**

---

*Версия 3.2 | Дата: 2026-05-28 | Предыдущая: 3.1 (2026-05-21) | Команда: продолжить активацию полного флоу онбординга*
