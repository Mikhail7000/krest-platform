# Feature: Curator Dashboard

> Проект: КРЕСТ
> Дата: 2026-05-21
> Приоритет: **High**
> Оценка: 2-3 дня (БД + API + UI)

---

## 1. User Story

**Как** куратор (лидер группы),
**я хочу** видеть список своих студентов с прогрессом по блокам и управлять их сабмишенами,
**чтобы** отслеживать выполнение домашних заданий, одобрять/отклонять работы и отправлять экзамены.

### Сценарий
1. Куратор заходит в `/admin/students` (или `/m/curator/dashboard`)
2. Видит список своих студентов с фильтром по блоку и статусу
3. Кликает на студента → видит его прогресс (какие пункты ДЗ сданы)
4. Видит новые сабмишены (текст, фото, видео, аудио) с кнопками:
   - **Одобрить** (со статусом approved)
   - **Отклонить** (с обязательным комментарием ≥10 символов)
   - **Отправить на экзамен** (после всех пунктов завершены)
5. Видит queue уведомлений:
   - Новый сабмишен от [имени]
   - Молчание 24h+ от [имени]
   - Молчание 3+ дней от [имени]
   - Экзамен пройден от [имени]

### Критерий приёмки
- [x] Куратор видит только своих студентов (RLS фильтрация)
- [x] Сабмишены загружаются с media_url (фото/видео/аудио из Storage)
- [x] Отклонение требует комментарий ≥10 символов
- [x] Одобрение запускает проверку block_completed
- [x] Notifications очищаются при клике
- [x] Экзамен отправляется через POST в студентский профиль

---

## 2. Изменения в БД

```sql
-- ============================================================
-- v3.0: submissions таблица для 12-пунктовой модели ДЗ
-- ============================================================
CREATE TABLE IF NOT EXISTS submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_id          INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  assignment_type   TEXT NOT NULL CHECK (assignment_type IN (
    'reflection_forum',     -- пункт 4: форум-рефлексия (3 вопроса)
    'summary',              -- пункт 5: конспект
    'daily_cross',          -- пункт 6: крест ежедневный
    'locations',            -- пункт 7: местописания
    'friday_practice',      -- пункт 11: эпоха пятницы
    'daily_report'          -- пункт 12: эмоции + ежедневный отчёт
  )),
  daily_recurring   BOOLEAN DEFAULT FALSE,  -- TRUE для пунктов 6, 9, 12
  submission_date   DATE NOT NULL,           -- день, когда сдано
  content_text      TEXT,                    -- текст ответа
  content_json      JSONB,                   -- структурированные данные (для форума, эмоций)
  media_url         TEXT,                    -- Storage URI (фото, видео, аудио)
  media_type        TEXT CHECK (media_type IN ('image', 'video', 'audio', null)),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',        -- ожидает одобрения куратора
    'approved',       -- одобрено куратором
    'auto_approved',  -- одобрено автоматически (Kinescope ≥95%)
    'rejected'        -- отклонено куратором
  )),
  reviewer_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- куратор, одобривший
  reviewer_comment  TEXT CHECK (
    (status = 'rejected' AND reviewer_comment IS NOT NULL AND char_length(reviewer_comment) >= 10)
    OR status != 'rejected'
  ),
  reviewed_at       TIMESTAMPTZ,             -- когда одобрено/отклонено
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, block_id, assignment_type, submission_date) -- одна сдача в день для recurring
);

CREATE INDEX IF NOT EXISTS idx_sub_user      ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_block     ON submissions(block_id);
CREATE INDEX IF NOT EXISTS idx_sub_status    ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_sub_date      ON submissions(submission_date);
CREATE INDEX IF NOT EXISTS idx_sub_reviewer  ON submissions(reviewer_id);

DROP TRIGGER IF EXISTS update_submissions_updated_at ON submissions;
CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Студент видит свои сабмишены
DROP POLICY IF EXISTS submissions_select_own ON submissions;
CREATE POLICY submissions_select_own ON submissions FOR SELECT
  USING (user_id = auth.uid() OR is_visible_to(auth.uid(), user_id) OR is_admin());

-- Куратор видит сабмишены своих студентов
DROP POLICY IF EXISTS submissions_select_curator ON submissions;
CREATE POLICY submissions_select_curator ON submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('curator', 'admin', 'super_admin')
        AND EXISTS (
          SELECT 1 FROM profiles s 
          WHERE s.id = submissions.user_id 
            AND (s.curator_id = p.id OR is_visible_to(auth.uid(), s.id))
        )
    )
  );

-- Студент может INSERT свои
DROP POLICY IF EXISTS submissions_insert_own ON submissions;
CREATE POLICY submissions_insert_own ON submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Куратор может UPDATE статус своих студентов
DROP POLICY IF EXISTS submissions_update_curator ON submissions;
CREATE POLICY submissions_update_curator ON submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('curator', 'admin', 'super_admin')
        AND EXISTS (
          SELECT 1 FROM profiles s 
          WHERE s.id = submissions.user_id 
            AND (s.curator_id = p.id OR is_visible_to(auth.uid(), s.id))
        )
    )
  )
  WITH CHECK (
    -- RLS проверка при UPDATE: reviewer_id должен быть текущий юзер, если статус меняется
    status IN ('pending', 'approved', 'rejected', 'auto_approved')
  );

DROP POLICY IF EXISTS submissions_all_admin ON submissions;
CREATE POLICY submissions_all_admin ON submissions FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE submissions IS
  'Сабмишены студентов по 12-пунктовой модели ДЗ (пункты 4, 5, 6, 7, 11, 12). Одобрение куратором или авто-одобрение при ≥95% Kinescope.';

-- ============================================================
-- notifications_log: история уведомлений куратору
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_id          INTEGER REFERENCES blocks(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'new_submission',      -- новый сабмишен
    'silence_1day',        -- молчание 1 день
    'silence_3days',       -- молчание 3+ дня
    'block_exam_ready',    -- студент готов к экзамену пункта 10
    'exam_passed'          -- экзамен пройден
  )),
  read_at           TIMESTAMPTZ,   -- когда куратор прочитал
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(curator_id, student_id, block_id, notification_type, created_at::DATE)
);

CREATE INDEX IF NOT EXISTS idx_notif_curator ON notifications_log(curator_id);
CREATE INDEX IF NOT EXISTS idx_notif_student ON notifications_log(student_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread  ON notifications_log(read_at) WHERE read_at IS NULL;

ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_select_own ON notifications_log;
CREATE POLICY notif_select_own ON notifications_log FOR SELECT
  USING (curator_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS notif_insert_system ON notifications_log;
CREATE POLICY notif_insert_system ON notifications_log FOR INSERT
  WITH CHECK (is_admin() OR curator_id = auth.uid());
```

---

## 3. Изменения в API

### Новые endpoints

#### `GET /api/curator/students`
**Описание:** Список студентов текущего куратора с прогрессом
**Авторизация:** curator, admin, super_admin
**Query params:**
  - `block_id?` (число) — фильтр по блоку
  - `status?` (string: not_started|video_watching|quiz_passed|locations_passed|block_completed)

**Ответ 200:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "full_name": "Анна Иванова",
      "avatar_url": "https://...",
      "current_block": 2,
      "status": "locations_pending",
      "last_activity_at": "2026-05-21T10:30:00Z",
      "submissions_pending": 3,
      "days_silent": 0
    }
  ]
}
```

#### `GET /api/curator/students/{student_id}/progress`
**Описание:** Детальный прогресс студента по блокам
**Авторизация:** curator (только своих студентов), admin
**Ответ 200:**
```json
{
  "ok": true,
  "data": {
    "student_id": "uuid",
    "blocks": [
      {
        "block_id": 1,
        "status": "block_completed",
        "submissions": [
          {
            "id": "uuid",
            "assignment_type": "reflection_forum",
            "status": "approved",
            "reviewed_at": "2026-05-19T14:00:00Z"
          },
          {
            "id": "uuid",
            "assignment_type": "daily_cross",
            "status": "pending",
            "submission_count": 5,
            "needed_count": 7
          }
        ]
      }
    ]
  }
}
```

#### `GET /api/curator/submissions?block_id=&status=pending`
**Описание:** Очередь сабмишенов для проверки (по блокам куратора)
**Авторизация:** curator, admin
**Ответ 200:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "student_id": "uuid",
      "student_name": "Анна Иванова",
      "block_id": 2,
      "assignment_type": "summary",
      "content_text": "Конспект...",
      "media_url": "gs://storage.../photos/...",
      "media_type": "image",
      "created_at": "2026-05-21T10:00:00Z",
      "status": "pending"
    }
  ]
}
```

#### `POST /api/curator/submissions/{submission_id}/approve`
**Описание:** Одобрить сабмишен
**Авторизация:** curator (если студент в группе), admin
**Запрос:** `{}`
**Ответ 200:**
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "status": "approved",
    "reviewed_at": "2026-05-21T15:30:00Z",
    "block_completed": false  // TRUE если это был последний сабмишен блока
  }
}
```

#### `POST /api/curator/submissions/{submission_id}/reject`
**Описание:** Отклонить сабмишен (требует комментарий)
**Авторизация:** curator, admin
**Запрос:**
```json
{
  "comment": "Нужно переписать второй вопрос, ответ неполный (минимум 10 символов)"
}
```
**Ответ 200:**
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "status": "rejected",
    "reviewer_comment": "...",
    "reviewed_at": "2026-05-21T15:30:00Z"
  }
}
```
**Ответ 400:** `{ "error": { "code": "COMMENT_TOO_SHORT", "message": "Comment must be at least 10 characters" } }`

#### `GET /api/curator/notifications?unread=true`
**Описание:** История уведомлений куратора
**Авторизация:** curator, admin
**Query params:**
  - `unread?` (bool) — только непрочитанные
  - `limit?` (число, default 50)

**Ответ 200:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "student_name": "Анна Иванова",
      "student_id": "uuid",
      "block_id": 2,
      "notification_type": "new_submission",
      "created_at": "2026-05-21T10:00:00Z",
      "read_at": null,
      "assignment_type": "summary"
    }
  ]
}
```

#### `PUT /api/curator/notifications/{notification_id}/read`
**Описание:** Отметить уведомление как прочитанное
**Авторизация:** curator
**Ответ 200:**
```json
{
  "ok": true,
  "data": { "read_at": "2026-05-21T15:35:00Z" }
}
```

### Изменения в существующих endpoints
- `POST /api/admin/students/attach-curator` — может быть использован при привязке студента
- `GET /student/{student_id}/progress` — может расширен для админки

---

## 4. Изменения в UI

### Новые компоненты

| Компонент | Расположение | Что показывает |
|-----------|-------------|----------------|
| `StudentList` | `/admin/students` | Список студентов куратора с фильтрами |
| `StudentProgress` | `/admin/students/[id]` | Прогресс студента по блокам + сабмишены |
| `SubmissionCard` | `components/curator/SubmissionCard.tsx` | Одна сабмишена со статусом, кнопками approve/reject |
| `RejectDialog` | `components/curator/RejectDialog.tsx` | Диалог для отклонения с текстовым полем комментария |
| `NotificationsQueue` | `/admin/dashboard` | Список уведомлений (новые сабмишены, молчания, экзамены) |

### Новые страницы

| Путь | Что показывает |
|------|----------------|
| `/admin/students` | Список студентов текущего куратора + очередь сабмишенов |
| `/admin/students/[id]` | Детальный прогресс студента с историей сабмишенов |

### Состояния

- **Loading:** Skeleton скелет для списка студентов
- **Empty:** "Нет студентов в группе" / "Нет новых сабмишенов"
- **Error:** Toast с текстом ошибки + кнопка retry
- **Unauthorized:** Редирект на `/login` если не куратор

### Макеты

```
/admin/students
┌─────────────────────────────────────┐
│  Мои студенты (5)   [фильтр блок] │
├─────────────────────────────────────┤
│ Анна (Блок 2)  ⏳ locations_pending │
│   ├─ 3 новых сабмишена               │
│   ├─ 0 дней молчания                 │
│   └─ [Перейти к прогрессу]          │
│                                       │
│ Павел (Блок 1)  ✅ block_completed  │
│   ├─ готов к экзамену (пункт 10)    │
│   └─ [Проверить]                    │
└─────────────────────────────────────┘

/admin/students/[id]
┌──────────────────────────────────────┐
│ Анна Иванова • Блок 2                 │
├──────────────────────────────────────┤
│ Прогресс:                             │
│  📹 Видео         ✅                  │
│  📝 Конспект      ⏳ (Ожидание)       │
│  ✝️  Крест (6 дн/7)  ✅               │
│  🗺️  Местописания  ⏳ (1 новая)      │
│  💬 Пятница       ✅                  │
│  😊 Эмоции (5 дн/7) ⏳                │
├──────────────────────────────────────┤
│ Новые сабмишены (1):                  │
│ ┌───────────────────────────────────┐ │
│ │ 📝 Конспект (2026-05-21 10:00)    │ │
│ │ "Тема 1: Принцип сотворения..."   │ │
│ │ [Одобрить] [Отклонить]            │ │
│ └───────────────────────────────────┘ │
└──────────────────────────────────────┘
```

---

## 5. Business Logic

### Правила

1. **RLS фильтрация:** Куратор видит только студентов, привязанных к нему через `profiles.curator_id`
2. **Отклонение:** Требует комментарий ≥10 символов, иначе 400 ошибка
3. **Одобрение:** После одобрения всех обязательных сабмишенов блока → автоматическое `is_block_completed()`
4. **Recurring пункты** (6, 12): Нужно минимум 7 уникальных дней с одобренными сабмишенами
5. **Notifications:** Создаются триггером при INSERT/UPDATE сабмишена, либо cron-джобом (молчание 24h+)
6. **Экзамен пункта 10:** После одобрения всех пунктов → статус меняется на "exam_ready", куратор видит кнопку "Сдать экзамен"

### Интеграции

- **Telegram Bot:** При новом сабмишене пушится уведомление в Telegram куратора (реализовано в отдельном API)
- **Kinescope:** Для видео-сабмишенов — если `media_type='video'` и видео из Kinescope, может быть авто-одобрено при ≥95%
- **Retry:** При ошибке API куратора (network fail) — сохранить в DB, потом cron переотправить

---

## 6. Edge Cases

| # | Ситуация | Поведение |
|---|----------|-----------|
| 1 | Студент прикреплён к двум кураторам одновременно | Использовать первого (по дате привязки) или показать ошибку при привязке |
| 2 | Куратор заменяется, новый куратор должен видеть прогресс старого | Данные остаются в БД, новый куратор видит переживаемые сабмишены через `is_visible_to()` |
| 3 | Студент сдаёт крест на 8-й день | Уже есть 7 одобренных → 8-й просто считается, пункт считается завершённым |
| 4 | Куратор отклонил, студент переотправил — создаётся новый сабмишен или обновляется старый? | **Новый** сабмишен (UNIQUE по user×block×assignment×date, но может быть несколько по разным датам) |
| 5 | Offline куратор — как sync notifications при восстановлении сети? | Notifications логируются в БД, при заходе куратор видит все unread через GET `/api/curator/notifications?unread=true` |
| 6 | Студент закончил все пункты, но куратор ещё не одобрил последний → может ли перейти на Блок 3? | **Нет**, block_gate требует ALL пунктов с `status IN ('approved', 'auto_approved')` |

---

## 7. Затронутые файлы (scope)

### Новые файлы

- `supabase/migrations/YYYYMMDDHHMMSS_v3_submissions.sql` — таблица submissions + RLS
- `supabase/migrations/YYYYMMDDHHMMSS_v3_notifications_log.sql` — таблица notifications_log
- `apps/web/src/app/admin/students/page.tsx` — главная страница куратора
- `apps/web/src/app/admin/students/[id]/page.tsx` — прогресс студента
- `apps/web/src/components/curator/StudentList.tsx` — список студентов
- `apps/web/src/components/curator/StudentProgress.tsx` — прогресс по блокам
- `apps/web/src/components/curator/SubmissionCard.tsx` — одна сабмишена
- `apps/web/src/components/curator/RejectDialog.tsx` — диалог отклонения
- `apps/web/src/components/curator/NotificationsQueue.tsx` — уведомления
- `apps/web/src/app/api/curator/students/route.ts` — GET студентов
- `apps/web/src/app/api/curator/students/[id]/progress/route.ts` — GET прогресс
- `apps/web/src/app/api/curator/submissions/route.ts` — GET очередь
- `apps/web/src/app/api/curator/submissions/[id]/approve/route.ts` — POST одобрить
- `apps/web/src/app/api/curator/submissions/[id]/reject/route.ts` — POST отклонить
- `apps/web/src/app/api/curator/notifications/route.ts` — GET уведомления
- `apps/web/src/app/api/curator/notifications/[id]/read/route.ts` — PUT отметить прочитано

### Изменяемые файлы

- `packages/supabase/src/types.ts` — regenerate после миграций (Database type)
- `.env.local` / `.env.production` — если нужны новые переменные
- `apps/web/src/middleware.ts` — если нужно добавить guard для `/admin/students`

---

## Примечания

- **Block gate функция:** Убедитесь, что `is_block_completed()` PL/pgSQL функция в БД проверяет именно наличие сабмишенов с `status IN ('approved', 'auto_approved')`, а не просто счёт
- **Telegram уведомления:** Реализованы как Server Action или Cron Job (см. lesson10_telegram_miniapp.md в памяти)
- **Permissions:** Используйте `requireAuth()` / `requireAdmin()` guards на странице `/admin/students`
- **Фильтры:** Минимально — по блоку и статусу. Можно позже добавить поиск по имени.

