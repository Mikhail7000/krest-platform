# КРЕСТ — Техническая спецификация

> Версия: 2.0 | Дата: 2026-04-26 | Статус: Production-ready (target state)
> Это документ **целевого состояния**. Текущая реализация частично совпадает; разрывы помечены 🔄.

---

## 0. Обзор проекта

### Что это
КРЕСТ — Telegram Mini App + веб-админка для русскоязычных евангельских церквей. Проводит ищущего Бога через 6 структурированных блоков знакомства с христианством за 6-12 недель под персональным наставничеством пастора.

### Стек технологий

| Слой | Технология | Версия |
|------|-----------|--------|
| **Веб (админка пастора + лендинг)** | Next.js (App Router) + TypeScript strict + Tailwind v4 + shadcn/ui | Next 16, React 19, Tailwind 4 |
| **Telegram Mini App (для студента)** | Vanilla HTML5 + CSS3 + JavaScript ES6+ + Telegram Web App SDK | — |
| **Backend** | Supabase (PostgreSQL 15, Auth, RLS, Storage) | latest |
| **Видео-плеер** | YouTube IFrame API | latest |
| **Уведомления** | Telegram Bot API + Resend SMTP | — |
| **Деплой** | Vercel (фронт+API), Supabase Cloud (БД) | — |
| **Платежи (после MVP)** | ЮKassa | — |
| **AI (опционально, post-MVP)** | Anthropic Messages API | claude-sonnet-4-6 |

**Запреты:** Cursor, Lovable, n8n, Supabase Edge Functions, Stripe, OpenAI.

### Двойная архитектура

```
┌────────────────────────────────────────────────────────────────┐
│              КРЕСТ — два frontend, один backend                │
└────────────────────────────────────────────────────────────────┘

┌─── Telegram Mini App ─────────┐    ┌─── Next.js веб-админка ────┐
│ apps/web/public/miniapp/      │    │ apps/web/src/app/          │
│ Vanilla HTML/CSS/JS           │    │ Next.js 16 + React 19      │
│ Для студента (через Telegram) │    │ Для пастора (десктоп/моб) │
│ index/lesson/admin/profile.html│    │ /admin /student /login    │
└──────────┬─────────────────────┘    └──────────┬─────────────────┘
           │                                     │
           └──────────────┬──────────────────────┘
                          ▼
           ┌─────────────────────────────────┐
           │  Next.js API Routes             │
           │  apps/web/src/app/api/*         │
           │  /api/miniapp/notify            │
           │  /api/miniapp/notify-rejection  │
           │  /api/miniapp/notify-registration│
           │  /api/admin/approve             │
           │  /api/student/journal           │
           │  /api/telegram/webhook          │
           │  /api/auth/logout               │
           └──────────────┬──────────────────┘
                          ▼
           ┌─────────────────────────────────┐
           │  Supabase                       │
           │  PostgreSQL + Auth + RLS + Storage │
           └─────────────────────────────────┘
```

**Почему двойная:** Telegram WebView плохо работает с Next.js SSR. Студенты сидят в Telegram → им нужен лёгкий vanilla. Пасторы могут зайти с любого устройства → им подходит Next.js админка.

### Роли пользователей

| Роль | Описание | Доступ |
|------|----------|--------|
| `student` | Ищущий Бога / изолированный верующий | Свои блоки, свой прогресс, свой форум, своя группа |
| `admin` | Пастор-партнёр (лидер) | Все студенты своей церкви, одобрение блоков, контент |
| `super_admin` | Команда КРЕСТ | Все церкви, управление пасторами, контент-владельцем |

### Маршруты

**Telegram Mini App (для студента):**
| Путь | Экран | Доступ |
|------|-------|--------|
| `/miniapp/index.html` | Регистрация / лендинг бота | Публичный |
| `/miniapp/setup.html` | Онбординг (имя, контакт, источник) | Авторизованный |
| `/miniapp/index.html` (после входа) | Дашборд: 6 блоков, прогресс, streak | student |
| `/miniapp/lesson.html?blockId=N` | Видео + форум + конспект блока | student |
| `/miniapp/trainer.html` | Тренажёр стихов (повторение) | student |
| `/miniapp/profile.html` | Профиль студента | student |
| `/miniapp/admin.html` | Панель лидера в Telegram | admin |

**Next.js веб-админка (для пастора):**
| Путь | Экран | Доступ |
|------|-------|--------|
| `/` | Лендинг КРЕСТ для пасторов | Публичный |
| `/login` | Вход | Публичный |
| `/admin` | Дашборд лидера: статистика, ожидающие | admin |
| `/admin/students` | Список студентов с фильтрами | admin |
| `/admin/cohorts` 🔄 | Малые группы | admin |
| `/admin/editor` | Редактор контента | admin |
| `/student` | (legacy) дашборд студента в вебе | student |

---

## БЛОК 1: User Stories

### US-001: Регистрация ищущего через Telegram-бот

**Как** ищущий Бога, который попал в Telegram-бот @cross_bot,
**я хочу** зарегистрироваться за 60 секунд через Mini App,
**чтобы** сразу начать первый блок без сложных форм и email-подтверждений.

**Сценарий:**
1. Открываю Telegram-бот → Start
2. Бот пишет "Добро пожаловать в КРЕСТ" + кнопка "Открыть приложение"
3. Открывается Mini App → форма регистрации (имя, email, пароль, контакт, "откуда узнал")
4. Подтверждаю email через ссылку (Resend SMTP → инбокс)
5. Возвращаюсь в Mini App → автоматически залогинен → онбординг (тип, цели)
6. Получаю экран дашборда с разблокированным блоком 1 ("Принцип Сотворения")

**Критерий приёмки:**
- [ ] Регистрация занимает ≤60 секунд от Start до экрана дашборда
- [ ] Email подтверждения приходит за ≤30 секунд
- [ ] При повторе email — сообщение "уже зарегистрирован, войдите"
- [ ] После регистрации — автоматическое уведомление лидеру в Telegram
- [ ] `telegram_chat_id` сохраняется автоматически из `tg.initDataUnsafe.user.id`

### US-002: Прохождение блока (видео → форум → одобрение)

**Как** студент с разблокированным блоком,
**я хочу** посмотреть видео без возможности перемотки и ответить на 3 вопроса,
**чтобы** реально проработать материал и получить одобрение лидера.

**Сценарий:**
1. На дашборде нажимаю активный блок → `/miniapp/lesson.html?blockId=1`
2. Видео загружается (YouTube IFrame), конспект скрыт
3. Смотрю видео — пробую перемотать вперёд → polling 500ms возвращает к maxWatched
4. При watched ≥95% активируется форум (3 textarea, мин. 100 символов каждый)
5. Заполняю → "Отправить ответы" → запись в `journal_entries` + `student_progress`
6. Откpывается конспект блока + статус "⏳ Ожидает проверки лидера"
7. Лидер получает push в Telegram → одобряет → следующий блок открывается
8. Получаю push "Блок 1 одобрен!"

**Критерий приёмки:**
- [ ] YouTube no-skip работает: перемотка вперёд блокируется через polling
- [ ] Кнопка форума активируется только при `maxWatched / duration ≥ 0.95`
- [ ] Минимум 100 символов на каждый вопрос (валидация на клиенте + сервере)
- [ ] Конспект показывается только ПОСЛЕ отправки форума (display:none → block)
- [ ] Уведомление лидеру в Telegram приходит за ≤5 секунд через `/api/miniapp/notify`

### US-003: Одобрение блока лидером с возможностью отклонения

**Как** пастор-партнёр,
**я хочу** прочитать ответы студента и одобрить блок ИЛИ отклонить с комментарием,
**чтобы** обеспечить персональное наставничество и качественное прохождение.

**Сценарий:**
1. Получаю Telegram-уведомление "Михаил завершил Блок 1"
2. Открываю `/miniapp/admin.html` или web-админку
3. На вкладке "Ожидают" вижу карточку студента + кнопка "📝 Читать ответы"
4. Читаю ответы → решаю одобрить или отклонить
5. **Одобрение:** `UPDATE student_progress SET admin_approved=true` + `blocks_unlocked += 1` + push студенту "✅ Блок одобрен"
6. **Отклонение:** заполняю комментарий → `DELETE journal_entry` + `DELETE student_progress` + push студенту "🔄 Блок требует доработки: [комментарий]"

**Критерий приёмки:**
- [ ] Комментарий отклонения обязателен (валидация)
- [ ] При отклонении студент видит блок снова доступным с видео-форумом-заново
- [ ] При одобрении следующий блок разблокируется (если есть, max 6)
- [ ] Push студенту приходит за ≤5 сек (если у студента есть `telegram_chat_id`)

### US-004: Streak — ежедневная мотивация

**Как** студент,
**я хочу** видеть свою серию дней подряд (streak) и получать мягкое восстановление при пропуске,
**чтобы** не бросить курс из-за одного пропущенного дня.

**Сценарий:**
1. Захожу в Mini App → создаётся запись `streak_logs` для текущего дня (если ещё не создана)
2. На дашборде вижу "🔥 Серия: 5 дней"
3. Пропускаю день → завтра вижу "🔄 Догоним вместе! Вчера ты пропустил"
4. Кнопка "Восстановить серию" → продолжаю с того же streak

**Критерий приёмки:**
- [ ] Streak инкрементируется только при заходе в Mini App ИЛИ выполнении действия (просмотр видео, отправка форума)
- [ ] Один заход в день = +1 к streak (повторные не считаются)
- [ ] Catch Me Up работает в течение 7 дней после пропуска
- [ ] Streak сбрасывается до 1, если пропуск >7 дней

### US-005: Малая группа (auto-cohort)

**Как** студент, начавший блок,
**я хочу** автоматически попасть в Telegram-группу с 5-12 другими студентами этого же блока,
**чтобы** обсуждать вопросы и не учиться в изоляции.

**Сценарий:**
1. Захожу на блок 1 первый раз → система ищет открытую `cohort` на этом блоке с количеством <12
2. Если есть → добавляюсь в `cohort_members` + получаю invite-link в Telegram-группу
3. Если нет → создаётся новая `cohort` → добавляюсь как первый
4. После 12 человек cohort закрывается, новые попадают в следующую

**Критерий приёмки:**
- [ ] Cohort создаётся автоматически при первом входе в блок
- [ ] Telegram-группа создаётся через Bot API (`createChatInviteLink`)
- [ ] Invite-link отправляется студенту в Telegram + видна в Mini App
- [ ] Когда блок завершён всеми участниками cohort → группа архивируется (через 14 дней)
- [ ] Лидер автоматически добавлен в каждую cohort своей церкви

### US-006: Регистрация пастора-партнёра (B2B)

**Как** пастор евангельской церкви,
**я хочу** зарегистрировать свою церковь на КРЕСТ через веб-сайт,
**чтобы** начать вести свою аудиторию через платформу.

**Сценарий:**
1. Захожу на лендинг КРЕСТ → "Стать партнёром"
2. Заполняю: название церкви, моё имя, email, размер общины, регион
3. Подтверждаю email → попадаю в `/admin` дашборд
4. Получаю invite-ссылку и QR-код для своих прихожан
5. Прихожане заходят через ссылку → регистрируются → автоматически привязываются к моей церкви (`nastavnik_id = my_id`)

**Критерий приёмки:**
- [ ] Регистрация пастора создаёт запись в `churches` + назначает роль `admin`
- [ ] Invite-ссылка содержит уникальный токен `?ref=church_uuid`
- [ ] При регистрации студента через invite-ссылку — `nastavnik_id` = пастор автоматически
- [ ] Пастор видит дашборд только своих студентов (RLS by `nastavnik_id`)

### US-007: Тренажёр стихов

**Как** студент, прошедший блок 3,
**я хочу** повторять выученные стихи Библии в режиме тренажёра,
**чтобы** запомнить их надолго.

**Сценарий:**
1. Захожу в `/miniapp/trainer.html` → вижу свои стихи из `bible_verses`
2. Тренажёр показывает референс ("Иоанн 3:16") → ввожу текст
3. Система проверяет (с учётом опечаток ≤2) → засчитывает / показывает правильный
4. Прогресс: `memorized = TRUE` после 3 успешных повторений

**Критерий приёмки:**
- [ ] Алгоритм проверки допускает опечатки до 2 символов
- [ ] Прогресс показывает "12 из 30 запомнено"
- [ ] Можно вернуться к не-запомненным стихам отдельным фильтром

---

## БЛОК 2: Data Model

### Диаграмма связей

```
auth.users (Supabase) ──1:1── profiles ──N:1── churches
                                  │              │
                                  │              ├── 1:N ── pastor_subscriptions
                                  │              │
                                  │              └── 1:N ── cohorts ──1:N── cohort_members ──N:1── profiles
                                  │
                                  ├──1:N── student_progress ──N:1── blocks ──1:N── lessons
                                  ├──1:N── journal_entries ──N:1── blocks
                                  ├──1:N── bible_verses
                                  ├──1:N── streak_logs
                                  ├──1:N── block_rejections (история отклонений)
                                  └──1:N── notifications_log
```

### Существующие таблицы (требуют миграций для приведения к target state)

#### profiles ✅ (все колонки применены через миграции)
```sql
-- Базовые поля (созданы в исходной schema.sql)
id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
email           TEXT
full_name       TEXT
role            TEXT DEFAULT 'student' CHECK (role IN ('admin', 'student'))
lang            TEXT DEFAULT 'ru' CHECK (lang IN ('ru', 'en'))
avatar_url      TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()

-- Геолокация и интересы (legacy, использование опционально)
location_name   TEXT          -- legacy, постепенно мигрируем на city
latitude        NUMERIC(9,6)  -- legacy
longitude       NUMERIC(9,6)  -- legacy
interests       TEXT          -- legacy, не используется в MVP

-- Локализация и регион (актуальные)
city            TEXT
region          TEXT CHECK (region IN ('russia', 'international'))
gornitsa_type   TEXT CHECK (gornitsa_type IN ('online', 'offline'))  -- тип церкви студента

-- Прогресс по курсу
blocks_unlocked INTEGER DEFAULT 1 CHECK (blocks_unlocked BETWEEN 1 AND 6)
onboarding_done BOOLEAN DEFAULT FALSE

-- Telegram интеграция
telegram_chat_id BIGINT       -- для push-уведомлений

-- Источник пользователя (для маркетинговой аналитики)
referral_source TEXT          -- Instagram/TikTok/Telegram/от друга/YouTube/Другое
referral_detail TEXT          -- свободный текст
contact_info    TEXT          -- любой контакт студента (Telegram username, телефон)

-- Связь с лидером и церковью
nastavnik_id    UUID REFERENCES profiles(id) ON DELETE SET NULL
church_id       UUID REFERENCES churches(id) ON DELETE SET NULL  -- B2B-партнёр

-- Streak механика (Bible.com style)
streak_count    INTEGER DEFAULT 0
last_active_date DATE
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

> **Legacy-колонки** (`location_name`, `latitude`, `longitude`, `interests`): пока не удаляем — могут использоваться где-то в коде. Аудит при следующем рефакторинге.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Расширить CHECK для роли
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'admin', 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_profiles_nastavnik_id ON profiles(nastavnik_id);
CREATE INDEX IF NOT EXISTS idx_profiles_church_id ON profiles(church_id);
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id ON profiles(telegram_chat_id);
```

#### blocks (без изменений)
Таблица контента: 6 блоков курса. ID = SERIAL (так как контент, не пользовательские данные).

#### lessons (без изменений)
Уроки внутри блоков.

#### student_progress 🔄 (добавить admin_approved + rejection_count)
```sql
ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);
ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0;
```

#### journal_entries (без изменений критичных)

#### bible_verses, uploads, weekly_submissions (без изменений)

### Новые таблицы (для MVP+)

#### churches 🆕
```sql
-- Церкви-партнёры (B2B)
CREATE TABLE IF NOT EXISTS churches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  pastor_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  region          TEXT,
  size            TEXT CHECK (size IN ('small', 'medium', 'large', 'network')),
  invite_token    TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  plan            TEXT DEFAULT 'free' CHECK (plan IN ('free', 'church', 'network', 'enterprise')),
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_churches_pastor_id ON churches(pastor_id);
CREATE INDEX idx_churches_invite_token ON churches(invite_token);

ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
CREATE POLICY churches_select_own ON churches FOR SELECT
  USING (pastor_id = auth.uid() OR is_admin());
CREATE POLICY churches_insert_authenticated ON churches FOR INSERT
  WITH CHECK (pastor_id = auth.uid());
CREATE POLICY churches_update_pastor ON churches FOR UPDATE
  USING (pastor_id = auth.uid());
```

#### streak_logs 🆕
```sql
-- Лог ежедневной активности для streak
CREATE TABLE IF NOT EXISTS streak_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  activity    TEXT NOT NULL CHECK (activity IN ('login', 'video_watched', 'forum_submitted', 'verse_memorized')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, log_date, activity)
);

CREATE INDEX idx_streak_logs_user_date ON streak_logs(user_id, log_date DESC);

ALTER TABLE streak_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY streak_logs_select_own ON streak_logs FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY streak_logs_insert_own ON streak_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
```

#### cohorts + cohort_members 🆕
```sql
-- Малые группы — авто-объединение студентов одного блока
CREATE TABLE IF NOT EXISTS cohorts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id            INTEGER REFERENCES blocks(id) ON DELETE CASCADE NOT NULL,
  church_id           UUID REFERENCES churches(id) ON DELETE CASCADE,
  telegram_chat_id    BIGINT,                 -- ID Telegram-группы
  telegram_invite_link TEXT,                  -- ссылка на вступление
  status              TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
  member_count        INTEGER DEFAULT 0 CHECK (member_count BETWEEN 0 AND 12),
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  closed_at           TIMESTAMPTZ
);

CREATE INDEX idx_cohorts_block_status ON cohorts(block_id, status) WHERE status = 'open';
CREATE INDEX idx_cohorts_church ON cohorts(church_id);

CREATE TABLE IF NOT EXISTS cohort_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id   UUID REFERENCES cohorts(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(cohort_id, user_id)
);

ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_members ENABLE ROW LEVEL SECURITY;
-- Студент видит свои когорты, лидер видит когорты своей церкви
CREATE POLICY cohorts_select_member_or_admin ON cohorts FOR SELECT USING (
  is_admin() OR id IN (SELECT cohort_id FROM cohort_members WHERE user_id = auth.uid())
);
CREATE POLICY cohort_members_select_own_or_admin ON cohort_members FOR SELECT USING (
  user_id = auth.uid() OR is_admin()
);
```

#### block_rejections 🆕
```sql
-- История отклонений блоков с комментариями
CREATE TABLE IF NOT EXISTS block_rejections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  block_id            INTEGER REFERENCES blocks(id) ON DELETE CASCADE NOT NULL,
  rejected_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rejection_comment   TEXT NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_block_rejections_user_block ON block_rejections(user_id, block_id);

ALTER TABLE block_rejections ENABLE ROW LEVEL SECURITY;
CREATE POLICY block_rejections_select_own_or_admin ON block_rejections FOR SELECT USING (
  user_id = auth.uid() OR is_admin()
);
CREATE POLICY block_rejections_insert_admin ON block_rejections FOR INSERT
  WITH CHECK (is_admin());
```

#### notifications_log 🆕
```sql
-- Лог отправленных уведомлений (Telegram, email)
CREATE TABLE IF NOT EXISTS notifications_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (channel IN ('telegram', 'email')),
  type            TEXT NOT NULL,
  payload         JSONB,
  status          TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'queued')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_notifications_user_created ON notifications_log(user_id, created_at DESC);
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_admin_only ON notifications_log FOR ALL USING (is_admin());
```

### Триггер обновления updated_at (универсальная функция) 🆕
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применить ко всем таблицам с updated_at
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_churches_updated_at BEFORE UPDATE ON churches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## БЛОК 3: API Endpoints

### Существующие routes (проверены и работают)

#### `POST /api/miniapp/notify`
**Назначение:** уведомление лидеру при отправке форума студента.
**Запрос:** `{ access_token, block_num, block_name, student_name, preview }`
**Ответ:** `{ ok: true }`
**Статус:** ✅ работает

#### `POST /api/miniapp/notify-rejection`
**Назначение:** уведомление студенту об отклонении блока + удаление прогресса.
**Запрос:** `{ student_id, block_id, block_num, block_name, leader_name, comment }`
**Ответ:** `{ ok: true }`
**Статус:** ✅ работает (после правок 26.04)

#### `POST /api/miniapp/notify-registration`
**Назначение:** уведомление всем admin о новом студенте.
**Запрос:** `{ name, email, contact, source, detail }`
**Ответ:** `{ ok: true }`
**Статус:** ✅ работает

### Новые routes (для MVP+) 🆕

#### `POST /api/miniapp/streak/log`
**Назначение:** записать ежедневную активность пользователя.
**Авторизация:** Bearer token студента.
**Запрос:**
```json
{ "activity": "login" }
```
**Ответ 200:**
```json
{
  "ok": true,
  "data": {
    "streak_count": 5,
    "is_new_day": true,
    "catch_me_up_available": false
  }
}
```
**Ответ 401:** `{ "error": { "code": "UNAUTHORIZED", "message": "Требуется авторизация" } }`

#### `POST /api/miniapp/cohort/join`
**Назначение:** автоматически найти/создать cohort для блока и присоединить студента.
**Авторизация:** Bearer token студента.
**Запрос:** `{ "block_id": 1 }`
**Ответ 200:**
```json
{
  "ok": true,
  "data": {
    "cohort_id": "uuid",
    "telegram_invite_link": "https://t.me/+abc123...",
    "member_count": 7,
    "is_new_cohort": false
  }
}
```

#### `GET /api/admin/cohorts`
**Назначение:** список cohorts для церкви пастора.
**Авторизация:** Bearer token admin.
**Параметры:** `?status=open|closed&block_id=N`
**Ответ 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "block": { "order_num": 1, "title_ru": "Принцип Сотворения" },
      "member_count": 7,
      "status": "open",
      "created_at": "2026-04-26T..."
    }
  ],
  "meta": { "total": 12, "page": 1, "per_page": 20 }
}
```

#### `POST /api/admin/church/register`
**Назначение:** регистрация церкви-партнёра.
**Запрос:**
```json
{
  "church_name": "Церковь Благодати",
  "pastor_email": "pastor@church.ru",
  "pastor_name": "Иван Петров",
  "size": "medium",
  "region": "Москва"
}
```
**Ответ 200:**
```json
{
  "data": {
    "church_id": "uuid",
    "invite_link": "https://t.me/cross_bot?start=ref_abc123",
    "qr_code_url": "..."
  }
}
```

### Стандарт ответов API

**Успех:** `{ "ok": true, "data": {...}, "meta": {...} }`
**Ошибка:** `{ "error": { "code": "ERROR_CODE", "message": "Описание" } }`
**HTTP-коды:** 200 OK | 201 Created | 400 Bad Request | 401 Unauthorized | 403 Forbidden | 404 Not Found | 500 Internal Server Error

---

## БЛОК 4: UI/UX

### Telegram Mini App — экраны

#### Экран: Дашборд студента (`/miniapp/index.html`)
**Layout:** Single column, mobile-first, тёмная тема (соответствует Telegram theme)

**Компоненты:**
- Header: аватар + имя + streak counter (🔥 5)
- Список 6 блоков (карточки): разблокирован / в процессе / ожидает одобрения / одобрен / залочен
- Кнопка "Профиль" + "Тренажёр стихов"

**Состояния:**
- **Loading:** skeleton 6 карточек блоков
- **Empty:** только блок 1 разблокирован, остальные с замком
- **Error:** toast "Не удалось загрузить блоки. Попробуйте обновить"

**Действия:**
1. Клик активного блока → `/miniapp/lesson.html?blockId=N`
2. Клик заблокированного → toast "Сначала пройдите блок N"
3. Клик "Тренажёр" → `/miniapp/trainer.html`

#### Экран: Урок (`/miniapp/lesson.html`)
**Layout:** Заголовок + видео + (форум | конспект)

**Компоненты:**
- Block badge ("Блок 1") + заголовок
- YouTube iframe (id=ytPlayer)
- Forum (3 textarea с counters, появляется после 95% видео)
- Konspekt section (появляется после форума)
- Approval status card (✅ одобрен / ⏳ ожидает / 🔄 требует доработки)

**Состояния:**
- **Loading:** spinner с текстом "Загрузка..."
- **Empty:** видео загружается, форум скрыт
- **Error:** "Блок не найден" + кнопка вернуться

**Действия:**
1. Видео doiграно ≥95% → форум активирован
2. Все 3 ответа ≥100 символов → кнопка "Отправить" активна
3. Submit → INSERT journal_entries + student_progress → push лидеру → показать конспект

#### Экран: Админ-панель в Telegram (`/miniapp/admin.html`)
**Компоненты:**
- Header (имя лидера + logout)
- Tabs: "Ожидают" / "Все студенты" / "Малые группы"
- Список карточек с действиями (Одобрить / Не одобрить с комментарием)

### Next.js веб-админка — экраны

#### Экран: Лендинг для пасторов (`/`)
**Layout:** Hero + Problem + Solution + Pricing + CTA

**Содержание (на основе PROJECT_IDEA):**
- H1: "Узнай христианство за 6 недель — с живым наставником в Telegram"
- Problem: 90% бросают онлайн-обучение → у пастора уходят ищущие
- Solution: 6 блоков + лидер + малые группы + Streak
- Pricing: Free / Церковь 3K / Сеть 10K / Enterprise
- CTA: "Стать партнёром" → форма регистрации церкви

#### Экран: Дашборд лидера (`/admin`)
**Компоненты:**
- Sidebar: Дашборд / Студенты / Малые группы / Контент / Профиль
- Main: Статистика (всего студентов / на блоках / завершили / активные неделю)
- Pending approvals (карточки) + кнопки Approve/Reject
- Last activities (последние ответы студентов)

### Дизайн-система (синхронизировано с UI_UX_BRIEF.md)

См. отдельный документ `UI_UX_BRIEF.md` для полного дизайн-брифа.

---

## БЛОК 5: Business Logic

### Правила и ограничения

| Правило | Что происходит при нарушении |
|---------|------------------------------|
| Пароль ≥8 символов, минимум 1 цифра | Inline ошибка под полем "Пароль слишком слабый" |
| Дубликат email при регистрации | "Этот email уже зарегистрирован, войдите" |
| Минимум 100 символов на каждый из 3 вопросов форума | Кнопка отправки disabled до выполнения |
| Блок N+1 заблокирован пока admin_approved=false для блока N | Toast "Сначала пройдите блок N с одобрением лидера" |
| Лидер может только UPDATE admin_approved=true (не выкл.) | RLS-политика блокирует обратное обновление |
| Студент не может удалить свой journal_entry после submit | RLS-политика без DELETE для роли student |
| Cohort не больше 12 человек | INSERT в cohort_members проверяется через CHECK + триггер |
| Streak обнуляется при пропуске >7 дней | Cron-задача 1 раз в сутки в 03:00 МСК |
| Email-подтверждение обязательно перед первым входом | Login возвращает "подтвердите email" |

### Процесс аутентификации

1. **Регистрация:** `POST /auth/v1/signup` (Supabase Auth) → email-подтверждение через Resend SMTP → click в письме → автоматический логин
2. **Вход:** `POST /auth/v1/token?grant_type=password` → JWT в localStorage (для Mini App) или httpOnly cookie (для веб)
3. **Логаут:** `_supabase.auth.signOut()` + редирект на /login или /miniapp/index.html
4. **Восстановление пароля:** `_supabase.auth.resetPasswordForEmail()` → ссылка в почту → форма нового пароля

### Внешние интеграции

#### Telegram Bot API
- **Назначение:** отправка push-уведомлений студенту/лидеру + создание малых групп
- **Что отправляем:** `chat_id, text, parse_mode: 'HTML'`
- **Что получаем:** `{ ok: true, result: {...} }`
- **При ошибке:** retry 1 раз через 30 сек → запись в `notifications_log` со статусом `failed`
- **Rate limit:** 30 сообщений/секунда — учитывать при массовых рассылках

#### YouTube IFrame API
- **Назначение:** видео-плеер с no-skip механикой
- **Polling:** каждые 500ms → `currentTime > maxWatched + 2` → `seekTo(maxWatched)`
- **Активация форума:** при `maxWatched / duration ≥ 0.95`
- **При ошибке загрузки:** показать сообщение "Видео временно недоступно. Попробуйте позже"

#### Resend SMTP
- **Назначение:** email-подтверждения регистрации, восстановление пароля
- **From:** `onboarding@resend.dev` (или собственный домен после настройки)
- **Лимит:** 100 emails/день free tier → upgrade при превышении

#### ЮKassa (post-MVP)
- **Назначение:** подписки пасторов 3K/10K ₽/мес
- **Webhook:** `/api/payments/webhook` → обновление `pastor_subscriptions.status`
- **Idempotency keys:** обязательны для всех мутаций
- **Test mode:** все платежи на dev-окружении через тестовые ключи

### Безопасность

| Аспект | Реализация |
|--------|-----------|
| Аутентификация | Supabase Auth (email/password) |
| Авторизация | RLS на всех таблицах |
| Валидация ввода | Zod-схемы во всех API routes (post-MVP) |
| Rate limiting | Vercel Edge Config (60 req/min на IP) — post-MVP |
| CORS | Strict origin для API: только домен Vercel |
| XSS | Студенческий ввод → `textContent`, лидерский контент → `innerHTML` |
| CSRF | SameSite cookies + проверка Origin header |
| Telegram WebApp validation | Verify `initData` через HMAC SHA256 + bot token |

### Cron-задачи (post-MVP)

| Задача | Расписание | Что делает |
|--------|------------|------------|
| Сброс streak при пропуске >7 дней | 03:00 МСК ежедневно | UPDATE profiles SET streak_count=0 WHERE last_active_date < NOW() - 7 days |
| Архив cohorts | 04:00 МСК ежедневно | Закрыть cohorts старше 14 дней |
| Daily digest для лидера | 09:00 МСК ежедневно | Email с сводкой активности студентов |
| Reminder студенту "Догоним вместе" | 19:00 МСК ежедневно | Telegram push если день пропущен |

---

## БЛОК 6: Edge Cases (15+)

### Сеть и доступность
| # | Ситуация | Триггер | Поведение |
|---|----------|---------|-----------|
| 1 | Пропала сеть во время сохранения форума | Submit | Сохранить в localStorage, retry при восстановлении, показать toast "Сохраняется..." |
| 2 | Telegram Bot API недоступен | Push не отправляется | Записать в `notifications_log` со статусом `failed`, retry через 30 сек, max 3 попытки |
| 3 | Supabase API возвращает 500 | Любой запрос | Toast "Сервер временно недоступен", retry через 3 сек, exponential backoff |
| 4 | YouTube IFrame не загрузился | Блок-урок | Показать "Видео недоступно. Попробуйте позже" + кнопка обновить |

### Данные и состояние
| # | Ситуация | Триггер | Поведение |
|---|----------|---------|-----------|
| 5 | Студент удалён лидером, но JWT ещё валиден | Запрос к API | RLS блокирует, возвращаем 403, фронт принудительно logout |
| 6 | Конкурентное одобрение блока (два лидера) | UPDATE student_progress | Optimistic UPDATE, последний выигрывает (acceptable) |
| 7 | Студент пытается отправить форум второй раз | Дубликат submit | Проверка наличия `journal_entry` → "Уже отправлено" |
| 8 | Cohort заполнился во время joining | INSERT cohort_members | Триггер проверяет `member_count >= 12` → создаёт новую cohort |

### Безопасность
| # | Ситуация | Триггер | Поведение |
|---|----------|---------|-----------|
| 9 | Студент подменяет block_id в URL | GET /lesson?blockId=99 | RLS проверка `blocks_unlocked >= block.order_num` → редирект на дашборд |
| 10 | Студент пытается одобрить свой же блок | POST /api/admin/approve | RLS блокирует (роль не admin) → 403 |
| 11 | Prompt injection в форум-ответе | Содержимое journal_entries | textContent + sanitize при отправке в Telegram (escape HTML) |
| 12 | Пытаются зарегистрировать пастора с чужим email | POST /api/admin/church/register | Email-подтверждение обязательно — пока не подтверждён, нет admin прав |

### Лимиты и производительность
| # | Ситуация | Триггер | Поведение |
|---|----------|---------|-----------|
| 13 | Студент отправляет форум 10 000 символов | Submit | Жёсткий лимит на сервере 5 000 символов, обрезка с предупреждением |
| 14 | Лидер церкви на 500 студентов открывает /admin | Загрузка списка | Пагинация по 20, виртуализация при scroll, индексы на `nastavnik_id` |
| 15 | Massive Telegram-рассылка (500 студентов одновременно) | Cron daily digest | Throttling 30 msg/sec, очередь через `notifications_log.status='queued'` |

### Время и часовые пояса
| # | Ситуация | Триггер | Поведение |
|---|----------|---------|-----------|
| 16 | Студент в UTC+10, день меняется не в полночь МСК | Streak счётчик | Использовать timezone из profiles.location или дефолт МСК |
| 17 | Блок одобрен в 23:59:59 МСК | Streak | Зачитываем активность за день одобрения |

### Платежи (post-MVP)
| # | Ситуация | Триггер | Поведение |
|---|----------|---------|-----------|
| 18 | ЮKassa webhook не дошёл | Платёж в подвешенном состоянии | Cron 1 раз в час проверяет статусы через ЮKassa API |
| 19 | Двойная оплата | Idempotency key совпадает | Отклонить, вернуть успех первой транзакции |
| 20 | Отмена подписки пастора | Webhook canceled | Снять `pastor_subscriptions.status='active'`, GraceDay 7 дней до полной блокировки |

---

## Приложение: разрывы между текущим состоянием и target state

### 🔄 Что уже есть (близко к target)
- ✅ Двойная архитектура (Next.js + Vanilla)
- ✅ Telegram Mini App с регистрацией
- ✅ 6 блоков с no-skip-видео и форумом
- ✅ Одобрение лидером + Telegram-уведомления
- ✅ Отклонение с комментарием (notify-rejection)

### 🔄 Что нужно добавить (приоритет для MVP+)
- ⏳ Streak механика (таблица `streak_logs`, push в 19:00 МСК)
- ⏳ Малые группы (`cohorts`, `cohort_members`, авто-создание Telegram-групп)
- ⏳ Регистрация церкви-партнёра (`churches`, invite-link)
- ⏳ B2B-монетизация (`pastor_subscriptions`, ЮKassa webhook)
- ⏳ Migrations вместо schema.sql (разбить на инкрементальные)
- ⏳ updated_at триггеры на всех таблицах

### 🔄 Что пересмотреть позже
- AI-ассистент для лидера (после feedback от первых 5 церквей)
- Сертификаты PDF (если будет спрос)
- Push-уведомления через сервис-воркер для веб-версии

---

*Версия 2.0 | Дата: 2026-04-26 | Spec-First Pipeline шаг 4/9*
