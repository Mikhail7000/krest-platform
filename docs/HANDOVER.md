# HANDOVER — точка входа для новой сессии

Прочитай этот файл + `docs/FIX_JOURNAL.md` (хронология всех правок и багов по датам).
Память проекта (`memory/MEMORY.md`) загружается автоматически — там индекс решений.

Последнее обновление: **2026-06-30**. Ветка `main`, всё закоммичено и задеплоено
(Vercel автодеплой при push). Проверка перед коммитом: `npm --workspace=@krest/web run`
не нужен — используй `cd apps/web && npx tsc --noEmit`.

---

## ОТКРЫТЫЕ ЗАДАЧИ (продолжить отсюда)

### 1. Роли «лидеры городов» — ФАЗА 4 ✅ ГОТОВА (2026-06-30)
Иерархия: **super_admin (Михаил) → admin (Эля) → city_leader → curator → student**.
Лидер привязан к городу (`profiles.city_id`), один на город. Все 4 фазы завершены:
- Экран «мои кураторы» для city_leader (scope по городу), перепривязка кураторов по
  городам (доска-колонки, admin-only), view-as для admin (curator/city_leader).
- Adversarial-ревью обнажило и закрыло пред-существующие дыры scoping лидера: критичная —
  `panel/enter` терял `city` при входе из бота → лидер видел всех; + fail-closed в
  `scope.ts`/`stats-data.ts`; + проверка чужого куратора в `add`; + `cities` роут под
  `isAdminRole`. Подробности — `docs/FIX_JOURNAL.md` (2026-06-30).
- Хелпер видимости — `apps/web/src/lib/admin/scope.ts`
  (`resolvePanelScope`/`studentInScope`/`cityCuratorIds`). Возможные доработки на будущее
  (по желанию Михаила): drag-and-drop в доске перепривязки; перепривязка ученика лидером
  внутри города (сейчас `transfer`/`attach` — admin-only); экран городов для лидера.

### 2. HEIC авто-конвертация (по желанию Михаила)
Сейчас фото креста в HEIC **отклоняется** (415) с просьбой JPEG — чтобы ИИ проверял
каждое фото. Михаил хотел авто-конвертацию HEIC→JPEG, но `npm install heic-convert`
в прошлой сессии **не разрешили**. Если разрешит — поставить `heic-convert`,
конвертировать в `api/m/cross-photo/upload/route.ts` перед ИИ-проверкой.

### 3. AI-чат — утечка чужого курса (латентно)
`api/m/trainer/ai-chat/route.ts`: при невалидном/чужом `blockId` → `courseId=null` →
в промпт попадают блоки ВСЕХ курсов. Сейчас курс один (КРЕСТ), не стреляет; закрыть
до запуска «10 писем» (гард `isBlockUnlocked` или ранний выход при `courseId=null`).

---

## КЛЮЧЕВОЙ КОНТЕКСТ

- **Дневная модель (КАНОН):** день закрыт = за ОДНУ локальную дату сданы ВСЕ 4 практики
  (фото креста + молитва + местописания-видео + пересказ-аудио); 7 закрытых дней → блок.
  Все 4 — ежедневные. Даты = `studentLocalToday` (пояс города, дефолт Бали). Эталон
  экранов — `api/m/cross-photo`. Подробности и частые баги — в `CLAUDE.md` (раздел
  «Дневные практики») и `memory/project_daily_day_model_canonical.md`.
- **Кто есть кто:** Михаил (Миша Моряк, sleezard@gmail.com) — super_admin, is_protected,
  единственный видит скрытых (`hidden_from_tracking`). Эля Ходус (@elyaforlife) — admin.
  Alex Magnier (@alex_magnier) — city_leader Москвы (city_id=10). Оля Мелешина
  (@Omeleshinka) — скрытый ученик (видит только владелец).
- **Прод-бот:** `@cross_notify_bot`. Токен ротирован 2026-06-30 (старый был утечкой в
  `js/config.js`, убран). Вебхук: `/api/telegram/webhook`; поставить из браузера —
  `GET /api/telegram/set-webhook` (super_admin или `?key=CRON_SECRET`).
- **SQL на проде** (без CLI): Supabase Management API,
  `POST https://api.supabase.com/v1/projects/aejhlmoydnhgedgfndql/database/query`,
  токен `sbp_...` из `.mcp.json`, тело строй через `jq -Rn --rawfile q FILE '{query:$q}'`.
- **Правила:** только русский; no `alert/confirm` (toast/inline); TS strict без `any`;
  миграции только через `supabase/migrations/`; коммит/деплой как обычно (git push в main).

---

## КАК ПРОДОЛЖИТЬ
Вставь в новую сессию prompt из ответа Михаилу (или: «Прочитай docs/HANDOVER.md и
docs/FIX_JOURNAL.md, продолжи с Фазы 4 ролей»).
