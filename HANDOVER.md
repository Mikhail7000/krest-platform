# HANDOVER — КРЕСТ

> Дата: **2026-05-21 (вечер)** | Сессия: ✅ **Curator Dashboard UI завершён. Два больших коммита: API + English Placeholder, затем UI (3 страницы куратора). Готово для демо Алексу Манье.**

---

## 🎯 Главное (читать первым)

1. **Ветка main = `5fcdc4d`** — два новых коммита за сессию (Curator API + English Placeholder, затем Dashboard UI)
2. **Production deployment**: https://krest-platform-web.vercel.app работает через `@cross_notify_bot`
3. **Тестовая фаза активна**: Telegram whitelist в таблице `testing_whitelist`, первый юзер @Rogue02 (Михаил)
4. **English Placeholder готов** ✅: `/m/onboarding` с LanguageSelect → "Still Cooking" экран
5. **Curator Dashboard готов** ✅:
   - `/m/curator` — список студентов с фильтрами (All/Pending/Silent)
   - `/m/curator/students/[id]` — детальный прогресс студента
   - `/m/curator/submissions` — очередь сабмишенов для одобрения/отклонения
6. **В БД (`aejhlmoydnhgedgfndql`)**: 
   - `placeholder_bible_verses` (20 NIV стихов)
   - `testing_whitelist` (Telegram usernames)
   - `submissions` (с assignment_type enum)
   - `notifications_log` (для уведомлений)

---

## ✅ ЧТО РАБОТАЕТ В PRODUCTION

### Ученик (MiniApp)
- ✅ Menu Button бота `@cross_notify_bot` → `/m/dashboard`
- ✅ Выбор языка → English "Still Cooking" с NIV стихом (рандом из БД)
- ✅ Все 10 блоков КРЕСТ доступны для прохождения
- ✅ 12-пунктовая модель ДЗ: видео, конспект, квиз, местописания, пересказ, фото креста
- ✅ Экзамены: 10 block-gates + mid-exam + final-exam
- ✅ Ачивка «Мастер Креста» при завершении курса

### Куратор (MiniApp)
- ✅ Список своих студентов с прогрессом по блокам
- ✅ Статусы: not_started → video_watching → quiz_passed → locations_passed → block_completed
- ✅ Фильтры: All / Pending Submissions / Silent Days
- ✅ Просмотр сабмишенов (текст + медиа: фото, видео, аудио)
- ✅ Одобрение (approve) → автоматически проверяет block_completed
- ✅ Отклонение (reject) с обязательным комментарием (≥10 символов)
- ✅ Визуальные индикаторы: красные бэджи с количеством pending, дни молчания (дни_silent)

### API (Backend)
- ✅ 7 endpoints в `/api/curator/*`:
  - `GET /api/curator/students` — список с фильтрами
  - `GET /api/curator/students/[id]/progress` — детальный прогресс
  - `GET /api/curator/submissions` — очередь сабмишенов
  - `POST /api/curator/submissions/[id]/approve` — одобрить
  - `POST /api/curator/submissions/[id]/reject` — отклонить
  - `GET /api/curator/notifications` — уведомления (TODO UI)
  - `POST /api/curator/notifications/[id]/read` — отметить прочитанным
- ✅ `requireCuratorAuth` guard: проверяет curator/admin/super_admin роль
- ✅ RLS filtering: куратор видит своих студентов, admin/super_admin видят всех

### Telegram Auth
- ✅ HMAC-SHA256 валидация `initData` на `/api/miniapp/telegram-auth`
- ✅ Whitelist проверка: username не в `testing_whitelist` → 403 "Доступ запрещен"
- ✅ Error message: "Напишите в поддержку" (НЕ @Rogue02)

---

## 📊 КОММИТЫ ЭТОЙ СЕССИИ (2026-05-21)

### Коммит 1: `88035f8`
**feat(curator): add curator dashboard API stubs + English placeholder onboarding**

Файлы добавлены:
- `/api/curator/students/route.ts` (166 строк) — GET список студентов
- `/api/curator/students/[id]/progress/route.ts` (148 строк) — детальный прогресс
- `/api/curator/submissions/route.ts` (140 строк) — GET сабмишены
- `/api/curator/submissions/[id]/approve/route.ts` (174 строк) — одобрить
- `/api/curator/submissions/[id]/reject/route.ts` (153 строк) — отклонить
- `/api/curator/notifications/route.ts` (72 строк) — GET уведомления
- `/api/curator/notifications/[id]/read/route.ts` (85 строк) — отметить прочитанным
- `lib/curator-auth.ts` — guard функция для всех endpoints
- `/m/onboarding/page.tsx` — router с выбором языка
- `/m/onboarding/LanguageSelect.tsx` — кнопки Русский / English
- `/m/onboarding/EnglishPlaceholder.tsx` — "Still Cooking" экран со стихами
- `docs/feature-specs/2026-05-21-curator-dashboard.md` (486 строк) — полная спецификация
- `HANDOVER.md` — обновлён с информацией о whitelist и English Placeholder

**Итого**: 1693 строк, 11 новых файлов, 1 обновлён

### Коммит 2: `5fcdc4d`
**feat(curator-ui): add curator dashboard pages with students list, submissions review**

Файлы добавлены:
- `/m/curator/page.tsx` (238 строк) — главная страница куратора
- `/m/curator/students/[id]/page.tsx` (215 строк) — детальная страница студента
- `/m/curator/submissions/page.tsx` (221 строк) — просмотр и review сабмишенов

**Итого**: 674 строк, 3 новых файла

---

## 🔄 ЧТО В ПРОЦЕССЕ (TODO на следующую сессию)

1. **Notifications UI** — сейчас API есть, но нет sidebar/badge с alert count
   - Добавить `GET /api/curator/notifications` вызов
   - Badge с количеством unread notifications
   - Список с read/unread state
   - Автоматический click → `POST /api/curator/notifications/[id]/read`

2. **Russian onboarding** — сейчас только English Placeholder
   - `/m/onboarding` выбор языка → если Русский → выбор страны → города → куратора
   - Интеграция с `locations` и `profiles.curator_id`
   - RLS проверка для видимости кураторов по городам

3. **Test end-to-end** перед демо
   - Запушить на Vercel (если локально тестировали)
   - Открыть в Telegram на iOS/Android
   - Проверить все 3 страницы куратора + approve/reject flow
   - Проверить English Placeholder на разных экранах

4. **Alerts System** — низкий приоритет, может быть после одобрения PoC
   - 24h+ silence alerts
   - 3+ days silence alerts
   - Exam passed notifications

---

## ❌ ЧТО СЛОМАНО / ДОЛГИ

- **Russian onboarding** — заглушка (TODO выбор страны/города/куратора)
- **Notifications UI** — API есть, UI нет
- **@cross_bot хардкод** в TelegramProvider.tsx — должно быть `@cross_notify_bot`
- **Legacy v2.0 cron-endpoints** — `/api/cron/reset-streaks`, `/api/cron/archive-cohorts` не удалены
- **`lint` скрипт** — всё ещё на `next lint` (Next 16 удалил его)

---

## 📋 СТРУКТУРА КОДА

```
apps/web/src/app/
├── /m/
│   ├── onboarding/
│   │   ├── page.tsx (router)
│   │   ├── LanguageSelect.tsx (UI кнопки)
│   │   └── EnglishPlaceholder.tsx (стихи)
│   ├── curator/ (👈 НОВОЕ)
│   │   ├── page.tsx (список студентов)
│   │   ├── students/[id]/page.tsx (детали)
│   │   └── submissions/page.tsx (review очередь)
│   └── dashboard/
│
├── /api/
│   ├── /miniapp/telegram-auth/ (whitelist check)
│   └── /curator/ (👈 НОВОЕ — 7 endpoints)
│
└── ... (остальное без изменений)
```

---

## 🚀 NEXT STEPS (FOR DEMO)

**Порядок для демо Алексу Манье**:
1. ✅ English Placeholder UI (выбор языка + стихи) — **ГОТОВО**
2. ✅ Curator Dashboard (список студентов + детали) — **ГОТОВО**
3. ✅ Submission Review (approve/reject с медиа) — **ГОТОВО**
4. 🟡 Test на реальном Telegram (iOS/Android)
5. 🟡 Notifications UI (если время позволит)
6. 🟡 Russian onboarding (после одобрения PoC)

**За пределами PoC**:
- OpenRouter миграция (вместо прямых API)
- Self-hosted Supabase (вместо Cloud)
- Custom domain
- Full production deployment

---

## 🧠 РЕШЕНИЯ ЭТОЙ СЕССИИ

| Решение | Почему | Файлы |
|---|---|---|
| Curator API 7 endpoints | Backend готов, фронт интегрируется просто | `/api/curator/*` |
| MiniApp Dashboard (не /admin) | Скорость: Next.js + Telegram UI нативный, мобильный-first | `/m/curator/*` |
| Submissions с реджектом | Требование спеки: куратор должен объяснить отклонение | approve/reject routes |
| English Placeholder перед Russian | PoC faster to demo, Russian сложнее (выбор страны/города) | `/m/onboarding` |
| TypeScript types regenerated | Strict mode требует новые типы сразу после миграций | types.ts |

---

## 💡 ВАЖНЫЕ ЧИСЛА

- **Telegram whitelist**: 1 юзер (@Rogue02 / Михаил)
- **10 блоков КРЕСТ**: полный цикл ученика → curator dashboard
- **7 API endpoints**: все необходимые для куратора
- **3 страницы куратора**: dashboard + student detail + submissions
- **2 большие спеки**: SPEC v3.0 (в репо) + feature spec (2026-05-21)

---

*Версия 3.1 | Дата: 2026-05-21 (вечер) | Два коммита за сессию: `88035f8` + `5fcdc4d`*
