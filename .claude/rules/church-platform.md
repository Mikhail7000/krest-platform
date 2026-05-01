---
description: КРЕСТ — доменные правила платформы (lesson flow, gates, ролевая иерархия, видимость)
globs: ["apps/web/src/app/m/**/*.tsx", "apps/web/src/app/admin/**/*.tsx", "apps/web/src/app/api/**/*.ts", "supabase/migrations/*.sql"]
---

# Доменные правила КРЕСТ v3.0

## 12-пунктовая модель ДЗ блока (одинакова для всех 10 блоков)

Структура — НЕ модифицировать. Это педагогическая модель курса, не техническое решение.

```
1.  Подготовка (info-экран)                        — авто
2.  Основное видео (Kinescope no-skip ≥95%)        — ✅ обязательно
3.  Дополнительное видео                           — ✅ обязательно (если есть в блоке)
4.  Форум-рефлексия (3 вопроса)                    — ✅ → push куратору
5.  Конспект (text/photo)                          — ✅ → одобрение куратора
6.  Писать крест ежедневно                         — ✅ recurring (мин. 7 дней с фото)
7.  Местописания (видео-кружок ИЛИ загрузка)       — ✅ → одобрение куратора
8.  Прослушать молитвы m4a (только Блок 1)         — авто
9.  Молитва ежедневно                              — recurring (галочка на доверии)
10. Сдача блока куратору (офлайн)                  — ✅ block exam
11. Эпоха пятницы (практика)                       — ✅ обязательно (включая удалённых учеников)
12. Эмоции + ежедневный отчёт (text)               — ✅ recurring (алерт куратору при пропуске)
```

## Block gate

```sql
-- Функция проверки завершения блока
SELECT is_block_completed(user_id, block_id);

-- Условие TRUE: ВСЕ обязательные пункты одобрены куратором (status IN ('approved', 'auto_approved'))
-- Для recurring пунктов (6, 12) — минимум 7 уникальных submission_date
-- При TRUE → trigger создаёт запись в course_progress для следующего блока
```

## Иерархия экзаменов

```
Блок 1 →🎓 Block exam (пункт 10) → Блок 2 →🎓→ ... → Блок 5 →🎓
                                                              ↓
                                          ⭐ MID-EXAM (другой куратор)
                                                              ↓
Блок 6 →🎓→ ... → Блок 10 →🎓
                              ↓
                  ⭐⭐⭐ FINAL EXAM (admin) → 🏆 Мастер Креста + 10 писем
```

- **Block exam (пункт 10):** офлайн. Куратор подтверждает «Сдал» вручную в админке. Видеосозвон в платформе НЕ реализован.
- **Mid-exam:** только один, после Блока 5 «Состояние Неверующего». Принимающий куратор `!= student.curator_id`.
- **Final exam:** у admin или super_admin. После passing → ачивка + course_progress[next_course].status='unlocked' через триггер.

## Ролевая иерархия и назначение

| Роль | Может назначить | Не может |
|---|---|---|
| `super_admin` | admin, curator, student; CRUD городов; передать управление | Разжаловать другого super_admin без согласия. **Никогда — пользователя с `is_protected=TRUE`** |
| `admin` | curator (в зоне), student | Повысить себя или другого до super_admin |
| `curator` | student (взять в свою группу) | Назначать другие роли |

**Ключевые правила:**
- Все изменения роли → запись в `role_change_log` (audit)
- Передача super_admin — отдельный endpoint `/api/admin/role/transfer-super-admin` с двойным подтверждением
- Прикрепление ученика к куратору — `/api/admin/student/attach-curator` (super_admin / admin)
- **Флаг `is_protected`** на `profiles` защищает владельца платформы (Михаил, sleezard@gmail.com) от разжалования. API возвращает 403 при попытке изменить такого пользователя. Снимается только прямым SQL.

## Видимость = маркер прогрессии

```sql
SELECT is_visible_to(viewer_id, target_id);
```

Логика:
- Сам себя — TRUE
- admin / super_admin → видят всех
- curator → видит своих учеников + кураторов своего города
- student → видит свою группу (одного куратора)
- При `course_progress.status='completed'` для общего курса — оба видят друг друга

Применяется в RLS на `profiles`, `course_progress`, `daily_activity`.

## Submissions — правила

```typescript
// СТУДЕНТ может INSERT свои
{ user_id: auth.uid(), assignment_id, content_*, status: 'pending' }

// КУРАТОР может UPDATE статус (свои или своего города)
{ status: 'approved' | 'rejected', reviewer_id: auth.uid(), reviewer_comment, reviewed_at }

// При rejected — обязателен reviewer_comment ≥10 символов
// При approved — comment опционален

// Recurring пункты (assignment.daily_recurring=TRUE) — одна submission на user×assignment×date
// Не-recurring — одна submission на user×assignment, можно перезалить (новая запись, старая помечается obsolete)
```

## Kinescope (видео-плеер)

- Embed iframe + кастомный no-skip overlay
- Polling currentTime каждые 500мс
- При `currentTime > maxWatched + 2` → принудительно `seekTo(maxWatched)`
- При `maxWatched / duration ≥ 0.95` → пункт автоматически переходит в `approved`
- CSP в `next.config.ts`: `frame-src https://kinescope.io`

## Гео и онбординг

- Регистрация: язык → страна → город → куратор → персональные данные
- При выборе города со статусом `coming_soon` — попадает в waitlist (`profiles.status='pending_city_activation'`)
- CRUD городов через `/admin/cities` (super_admin only)
- Timezone города влияет на cron silence-check и ежедневные отчёты

## Уведомления куратору (push в Telegram)

| Триггер | Текст |
|---|---|
| Submission создан | «[имя] (Блок N): новый [тип сабмишена]» |
| Готов сдавать пункт 10 | «[имя] просит сдать Блок N, договорись о горнице» |
| Cron 23:59 — нет ежедневного отчёта | «⚠️ [имя] не отчиталась 1 день» |
| Cron — 3+ дня тишины | «🚨 [имя] 3 дня тишины — напомни» |
| Mid-exam пройден | «[имя] сдала промежуточный экзамен» |
| Final exam пройден | «🏆 [имя] — Мастер Креста!» |

Все пуши логируются в `notifications_log`.

## i18n

- На старте — **только русский** (`lang = 'ru'` в profiles)
- Английский в будущем — с **отдельными материалами** (отдельная база контента, не перевод полей)
- Строки UI через i18n-словарь (`apps/web/src/lib/i18n/`), не хардкод
- `lang_constraint` в схеме оставлен на будущее, не используется сейчас

## Безопасность

- **XSS:** ввод ученика → React (auto-escape) или `textContent`. Контент куратора → DOMPurify перед `dangerouslySetInnerHTML`.
- **RLS:** на каждой таблице. Никаких bypass через service_role в браузере.
- **Telegram WebApp:** валидация `initData` через HMAC SHA256 на всех API-routes для MiniApp.
- **Rate limiting:** через Vercel Edge Config — 60 req/min per IP.
- **Maintenance mode:** whitelist по chat_id или `?bypass=<token>`.

## Что УБРАНО из v2.0 — не возвращать

- ❌ B2B (`churches`, `pastor_subscriptions`, ЮKassa)
- ❌ Vanilla MiniApp (всё на Next.js, legacy `public/miniapp/` мигрирует постепенно)
- ❌ YouTube IFrame API (заменён на Kinescope)
- ❌ 6-блочный курс (теперь 10)
- ❌ 3-вопросов-форум (расширен до 12 пунктов ДЗ)
- ❌ Streak Duolingo-стиля (`streak_logs`, `streak_count` в profiles) — заменено на `daily_activity` для куратора
- ❌ Cohorts auto-join — заменено на ручную привязку curator → student через `profiles.curator_id`
- ❌ `block_rejections` — стало частью `submissions.status='rejected'`
- ❌ Видеосозвон в платформе

При обнаружении этих сущностей в коде/спеке — флагать как legacy, постепенно мигрировать.

---

*Версия 3.0 | 2026-05-01 | Замещает v2.0*
