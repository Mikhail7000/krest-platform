# КРЕСТ — Техническая спецификация v3.0

> Версия: 3.0 | Дата: 2026-05-01 | Статус: целевое состояние (target state)
> Замещает SPEC v2.0. Реализация — поэтапно по `docs/spec-first/03-block1-maly-krest.md` (раздел 12).

---

## 0. Обзор

### Что это

КРЕСТ — **внутренняя платформа церкви** для управляемого ученичества по программе «Крест» из 10 блоков. Не коммерческая. Один Next.js-проект обслуживает три аудитории: учеников (Telegram MiniApp + веб), кураторов (веб-админка), руководство церкви (super-admin / admin).

**Финальная цель:** куратор доводит своих учеников до уровня «выучили крест и могут передавать его другим». После прохождения курса — ачивка «Мастер Креста» и доступ к следующему курсу.

**Архитектура мультикурсовая** — после КРЕСТ открывается «10 писем», затем «20 писем», далее по плану.

### Стек

| Слой | Технология | Версия |
|---|---|---|
| Веб + MiniApp + админка | Next.js (App Router) + TypeScript strict + Tailwind v4 + shadcn/ui + Framer Motion | Next 16, React 19, Tailwind 4 |
| Backend | Supabase (PostgreSQL 15, Auth, RLS, Storage) + Next.js API Routes | latest |
| Видео | Kinescope (embed iframe + кастомный no-skip overlay) | — |
| Email | Resend SMTP | — |
| Telegram | Bot API + WebApp SDK (HMAC-валидация initData) | — |
| ИИ-тренажёр стихов | Anthropic Messages API | claude-sonnet-4-6 |
| AI-генерация изображений | Midjourney (через подписку Михаила, $30/мес) | — |
| Деплой | Vercel + Supabase Cloud | — |

### Запреты

Cursor, Lovable, n8n, Supabase Edge Functions, Stripe, OpenAI, ЮKassa, видеосозвон в платформе.

### Архитектура — один Next.js, три аудитории

```
apps/web/src/app/
├── /                        ← Лендинг для всех (публичный)
├── /m/*                     ← MiniApp (открывается в Telegram + в браузере = фич-парити)
│   ├── onboarding           ← Язык → страна → город → куратор
│   ├── dashboard            ← Список курсов и блоков
│   ├── lesson/[blockId]     ← 12 пунктов ДЗ блока
│   ├── trainer              ← ИИ-тренажёр стихов
│   ├── chat                 ← Двусторонний чат с куратором
│   ├── important            ← «Важно» — Регламент, Разъяснение (curator+)
│   └── profile              ← Профиль ученика
├── /admin/*                 ← Веб-админка кураторов
│   ├── dashboard            ← Главный экран куратора
│   ├── group                ← Моя группа учеников
│   ├── calendar             ← Дневной трекинг активности
│   ├── student/[id]         ← Карточка ученика
│   ├── exams                ← Pending промежуточные + финальные экзамены
│   ├── important            ← «Важно» (curator+)
│   └── content              ← (super-admin only) контент блоков, города, роли
└── /api/*                   ← API routes (см. Блок 3)
```

**Двойная архитектура** v2.0 (Vanilla MiniApp + Next.js админка) **отменена**. Всё на Next.js. PoC `/m/dashboard` подтвердил работу в Telegram WebView (см. `memory/project_nextjs_miniapp_decision.md`).

### География

8 стран за пределами РФ + 19+ городов в РФ. На старте активен **только Бали**, остальные — статус «Скоро».

**Список (на 2026-05-01):**
- За пределами РФ: Бали (Индонезия), Пхукет (Тайланд), Дубай (ОАЭ), Тбилиси/Батуми (Грузия), Нагария (Израиль), Минск (Беларусь), Лас-Вегас (США), Лос-Анжелес (США), Дананг (Вьетнам)
- Россия: Москва, Санкт-Петербург, Кемерово, Екатеринбург, Томск, Омск, Тюмень, Ярославль, Калининград, Сочи, Нижний Новгород, Ростов, Иркутск, Казань, Калуга, Пермь, Уфа, Челябинск, Таганрог

**CRUD городов и стран — через админку super-admin.** Список не зафиксирован в коде, можно добавлять/убирать.

### Курсы (мультикурсовая архитектура с дня 1)

| # | Курс | Блоков | Статус | Открывается после |
|---|---|---|---|---|
| 1 | **КРЕСТ** | 10 | active (реализуем) | always unlocked |
| 2 | 10 писем | TBD | coming_soon (будущее) | финальный экзамен КРЕСТ |
| 3 | 20 писем | TBD | coming_soon (будущее) | финальный экзамен 10 писем |

10 блоков курса КРЕСТ:
1. Малый Крест
2. Принцип Сотворения
3. Коренная Проблема
4. Состояние Мира
5. Состояние Неверующего ← после него **промежуточный экзамен**
6. Усилие Человека
7. Обетования и Исполнение
8. Иисус Христос
9. Благословения Верующего
10. 5 Уверенностей ← после него **финальный экзамен** у admin

### Роли (4-уровневая иерархия + флаг владельца)

| Роль | Кто это | Кто назначает | Что может |
|---|---|---|---|
| `super_admin` | Команда КРЕСТ (на старте — только Михаил Телегин; позже Алекс, Эля, Игорь) | По seed | Всё. Назначать admin, curator. Редактировать контент. CRUD городов. Прикреплять учеников к кураторам. Видеть все аналитики |
| `admin` | Региональный руководитель | super_admin | Назначать кураторов в своей зоне. Прикреплять учеников. Видеть всё в своём регионе |
| `curator` | Лидер горницы | super_admin или admin | Принимает 12 пунктов ДЗ. Видит свою группу + других кураторов своего города |
| `student` | Ученик | super_admin / admin / curator | Учится. Видимость по прогрессии (см. ниже) |

**Передача прав:** super-admin может передать роль super-admin другому пользователю (через явное действие «Передать управление» с подтверждением). Admin не может повысить себя в super-admin.

**Флаг `is_protected` (владелец платформы):** на `profiles` есть колонка `is_protected BOOLEAN DEFAULT FALSE`. На старте только у Михаила (sleezard@gmail.com / chat_id 255214568) `is_protected = TRUE`. Защищённого пользователя **никто не может разжаловать или удалить** — ни другой super_admin, ни сам себя через UI. Сменить флаг можно только через прямой SQL в БД (намеренно неудобно). Это гарантирует что владелец платформы всегда остаётся в системе.

**Учеников могут «брать себе»** все три роли (super-admin, admin, curator). Super-admin и admin могут **прикрепить ученика к конкретному куратору** через UI.

### Видимость как маркер прогрессии

Видимость учеников **расширяется по мере прохождения курсов** — это часть смысла «ты стал своим, когда сдал крест».

| Стадия | Что видит ученик |
|---|---|
| Учится КРЕСТ | Только свою группу (своего куратора + однокурсников) |
| Сдал КРЕСТ (final exam) | + всех учеников платформы глобально (без чата по умолчанию) |
| Учится 10 писем | + свою группу 10 писем |
| Сдал 10 писем | + всех 10-писем-выпускников |
| … | … |

Куратор видит: всех своих учеников + всех других кураторов + учеников других кураторов своего города. Admin / super-admin видят всё.

### Только русский на старте

Английский — позже, **с отдельными материалами** (отдельная база контента, не перевод). Поле `lang` остаётся в схеме, на старте всегда `'ru'`. Когда придут английские видео и транскрипции — заведём `course_id=N (en)` параллельно.

### Дизайн-направление

- **Тема C: светлый с тёмными акцентами**. Hero на лендинге — тёмный «оазис» в светлом сайте.
- **Primary reference:** superhuman.com (премиальные тёмные градиенты, минимализм, cursor glow)
- **Стиль:** современный, минималистичный, стильный, с wow-эффектом. Никакого «церковного стиля» (готики, золота, икон).
- **Cursor glow эффект** — светящиеся точки следуют за курсором (Framer Motion + radial gradient).
- **Hero лендинга:** 100vh, фоновое изображение «небеса + светящийся крест» (Midjourney), цифры **237 стран / 5000 народностей / 7000 горниц / 7000 учеников**, цитата «Матфея 28:18-20 — Итак идите, научите все народы».
- **Реализация:** Tailwind v4 + shadcn/ui + Framer Motion + Lucide icons. Шрифты: Geist Sans (UI) + тёплый serif для заголовков.

Детали — в `UI_UX_BRIEF.md` (отдельный документ, обновляется на следующем шаге Этапа А).

---

## БЛОК 1: User Stories (17 штук)

### US-001: Регистрация ученика — язык → страна → город → куратор

**Как** новый человек, желающий пройти курс КРЕСТ,
**я хочу** зарегистрироваться через простой пошаговый онбординг с выбором гео и куратора,
**чтобы** сразу попасть в группу своего города и начать учиться.

**Сценарий:**
1. Открываю Telegram-бот → Start → кнопка «Открыть приложение». Или захожу на сайт `krest.ru/m/onboarding` через ноутбук.
2. **Шаг 1 — язык:** 🇷🇺 русский (на старте только эта опция активна) / 🇬🇧 английский (disabled «Coming soon»).
3. **Шаг 2 — страна:** Россия / 9 стран за рубежом. Выбираю.
4. **Шаг 3 — город:** список городов выбранной страны. Активные («Бали») кликабельны, остальные — «📍 Скоро» в waitlist.
5. **Шаг 4 — куратор:** список кураторов этого города с именем и фото. Если один — выбран автоматически. Если несколько — выбираю.
6. **Шаг 5 — личные данные:** имя, email, пароль, контакт (Telegram username опционально), как узнал.
7. Подтверждаю email → автоматический логин → дашборд с разблокированным Блоком 1.
8. Куратор получает push: «Новый ученик: [имя] из [город]».

**Критерии приёмки:**
- [ ] Онбординг проходится за ≤90 секунд от Start до дашборда
- [ ] При выборе города со статусом `coming_soon` — попадаю в waitlist, ученик создаётся со статусом `pending_city_activation`
- [ ] `telegram_chat_id` сохраняется автоматически из `tg.initDataUnsafe.user.id` если регистрация из Telegram
- [ ] При повторе email — «уже зарегистрирован, войдите»
- [ ] Куратор получает push за ≤5 секунд
- [ ] Ученик автоматически привязан к куратору через `profiles.curator_id`

### US-002: Прохождение блока через 12 пунктов ДЗ

**Как** ученик с разблокированным блоком,
**я хочу** последовательно выполнить 12 пунктов ДЗ под руководством куратора,
**чтобы** реально проработать материал и получить одобрение для перехода к следующему блоку.

**Сценарий:**
1. На дашборде нажимаю активный блок → `/m/lesson/[blockId]`.
2. Вижу **12 карточек-пунктов** в порядке (см. структуру ниже). Состояния: locked / available / in_progress / submitted / approved / rejected.
3. Прохожу пункт 1 (Подготовка) → читаю info-экран.
4. Пункт 2 — смотрю основное видео в Kinescope (no-skip 95%).
5. Пункт 3 — если есть дополнительное видео, смотрю его.
6. Пункт 4 — заполняю форум-рефлексию (3 вопроса). Куратор получает push.
7. Пункт 5 — загружаю конспект (текст или фото). Куратор одобряет / возвращает с комментарием.
8. Пункт 6 — каждый день кладу фото переписанного креста. Счётчик «N из 7 дней».
9. Пункт 7 — записываю кругляшок или загружаю видео местописания.
10. Пункт 8 — слушаю m4a-молитвы (только Блок 1).
11. Пункт 9 — отмечаю «помолился сегодня» (на доверии).
12. Пункт 11 — после практики «Эпохи пятницы» загружаю text/photo/voice.
13. Пункт 12 — каждый день пишу короткий отчёт. Если день закончился без отчёта — куратор получает алерт.
14. Пункт 10 — нажимаю «Готов сдавать блок куратору». Куратор принимает офлайн на горнице, ставит ✅.
15. Когда все обязательные пункты ✅ — следующий блок разблокируется. Получаю поздравительный push «Блок [N] пройден! Открыт [N+1]».

**Критерии приёмки:**
- [ ] Видео в Kinescope не перематывается вперёд (overlay блокирует skip)
- [ ] Форум-рефлексия — 3 поля, минимум 50 символов каждое
- [ ] Конспект — текст или фото, обязательно перед открытием пунктов 6-7
- [ ] Counter «писать крест» считает уникальные дни (1 фото в день)
- [ ] Кругляшок (видео-кружок) — макс 60 секунд, single-take, MediaRecorder
- [ ] Загрузка видео из галереи — формат mp4/mov, до 100 МБ
- [ ] Все обязательные пункты помечены ✅ в UI; необязательные — серым
- [ ] Block gate срабатывает только когда **все** ✅-пункты одобрены куратором

#### Структура 12 пунктов (одинакова для всех 10 блоков)

| # | Пункт | Обязателен | Способ |
|---|---|---|---|
| 1 | Подготовка (info) | — | авто |
| 2 | Основное видео | ✅ | авто (no-skip 95%) |
| 3 | Дополнительное видео (если есть) | ✅ | авто (no-skip 95%) |
| 4 | Форум-рефлексия (3 вопроса) | ✅ | text |
| 5 | Конспект | ✅ | text или фото |
| 6 | Писать крест ежедневно | ✅ | фото в день |
| 7 | Местописания (видео-кружок ИЛИ загрузка) | ✅ | video |
| 8 | Прослушать молитвы m4a (только Блок 1) | — | авто |
| 9 | Молитва по кресту ежедневно | — | галочка |
| 10 | Сдача куратору (офлайн) | ✅ | manual approve |
| 11 | Эпоха пятницы (практика) | ✅ | text/photo/voice |
| 12 | Эмоции + ежедневный отчёт | ✅ | text каждый день |

### US-003: Куратор одобряет/отклоняет пункты ДЗ

**Как** куратор группы,
**я хочу** видеть свежие сабмишены учеников и одобрять / возвращать их с комментарием,
**чтобы** обеспечить качество прохождения курса.

**Сценарий:**
1. Получаю push в Telegram: «Алина: новый конспект Блока 1, проверь».
2. Открываю `/admin/student/:id` или клик на push.
3. Вижу карточку сабмишена: тип (конспект), содержимое, дата.
4. Решаю:
   - **Одобрить:** ставлю ✅, опционально комментарий «Хороший конспект, зачёт».
   - **Отклонить с комментарием:** «Слабо раскрыта тема X, перепиши с акцентом на Y». Submission получает статус `rejected`, ученик видит замечание и переделывает.
5. Ученик получает push с моим решением.

**Критерии приёмки:**
- [ ] Куратор видит все pending сабмишены своей группы в одной ленте `/admin/dashboard`
- [ ] Комментарий при отклонении обязателен (валидация ≥10 символов)
- [ ] При отклонении submission переходит в `rejected`, ученик может перезалить новую версию
- [ ] Submission хранит историю всех версий (не перезаписывает)
- [ ] Push ученику за ≤5 сек

### US-004: Дневной календарь группы у куратора

**Как** куратор,
**я хочу** видеть календарную таблицу активности всех моих учеников по дням,
**чтобы** заметить кто молчит, кто опережает, и точечно поговорить.

**Сценарий:**
1. Открываю `/admin/calendar` → таблица: ученики × дни недели.
2. Каждая ячейка — иконки активности дня: ✅ отчёт, 📷 фото креста, 🎥 кругляшок, 📝 эпоха пятницы.
3. Сверху — фильтр недели (текущая / прошлая / выбрать).
4. Сверху — алерт-список: «⚠️ Алина не отчиталась 1 день», «🚨 Маша 3 дня тишины».
5. Клик на ученика → подробная карточка с историей.

**Критерии приёмки:**
- [ ] Таблица грузится за ≤500мс (индекс на `daily_activity.user_id, log_date`)
- [ ] Алерты автогенерируются cron'ом в 23:59 timezone города
- [ ] Куратор видит **своих** учеников + **по запросу** — учеников других кураторов своего города

### US-005: Куратор добавляет нового ученика в группу

**Как** куратор,
**я хочу** добавить нового ученика в свою группу через @username Telegram или контакт,
**чтобы** взять его в обучение без сложной регистрации.

**Сценарий:**
1. На `/admin/group` → кнопка «Добавить ученика».
2. Ввожу: имя, Telegram username (опц.), email или телефон (опц.), город.
3. Если есть TG username — система отправляет приглашение через бота.
4. Ученик открывает приложение → видит, что уже привязан ко мне → проходит онбординг (имя/email уже заполнены) → попадает на дашборд.
5. Если нет TG — получаю invite-link для отправки любым каналом. Ученик регистрируется в вебе → ждёт моего подтверждения → попадает в группу.

**Критерии приёмки:**
- [ ] Telegram-приглашение через `/api/curator/invite-via-bot` — отправка сообщения по username
- [ ] Invite-link содержит уникальный токен, действителен 7 дней
- [ ] При дубликате @username — «уже на платформе, привязать?» → реквест к существующему ученику
- [ ] Ученик-приглашённый стартует с Блока 1 разблокированным

### US-006: Block exam — сдача блока куратору (офлайн)

**Как** ученик, выполнивший все обязательные пункты блока,
**я хочу** сдать блок куратору устно на горнице,
**чтобы** получить одобрение и перейти к следующему блоку.

**Сценарий:**
1. Выполнил все ✅-пункты, кроме 10. На карточке пункта 10 кнопка «Готов сдавать».
2. Жму → куратору приходит push «Алина просит сдать Блок 1, договорись о горнице».
3. Куратор пишет мне в чат предложение времени.
4. Встречаемся офлайн (на горнице или лично). Я пересказываю Малый Крест максимально близко к видео.
5. Куратор оценивает → в админке ставит ✅ «Сдал» или 🔄 «Иди ещё раз».
6. При ✅ — пункт 10 закрыт, block gate срабатывает, следующий блок открывается. Получаю поздравительный push.
7. При 🔄 — пункт остаётся открытым, куратор пишет рекомендации, я готовлюсь и снова жму «Готов сдавать».

**Критерии приёмки:**
- [ ] Кнопка «Готов сдавать» активна только после одобрения всех остальных ✅-пунктов
- [ ] При ✅ block exam — все локальные кешированные данные пункта 10 очищаются
- [ ] Видеосозвон в платформу не встроен (см. project_lesson_model_v2.md). Куратор и ученик договариваются вне платформы

### US-007: Mid-exam — промежуточный экзамен после Блока 5

**Как** ученик, сдавший Блок 5 «Состояние Неверующего»,
**я хочу** пройти промежуточный экзамен у другого куратора,
**чтобы** проверить усвоение первой половины курса с независимой стороны.

**Сценарий:**
1. После approval пункта 10 Блока 5 — Блок 6 заблокирован экзамен-гейтом. Получаю push «Готовься к промежуточному экзамену по блокам 1-5».
2. Открываю `/m/lesson/exam-mid` → информация: формат, темы, как готовиться.
3. Куратор моей группы видит pending-экзамен в `/admin/exams` → распределяет меня к другому куратору моего города.
4. Сдаю офлайн. Принимающий куратор ставит ✅ «Сдал» или ❌ «Не сдал».
5. При ✅ — Блок 6 разблокирован.
6. При ❌ — комментарий с темой, к которой надо вернуться. Возможна пересдача через 7 дней.

**Критерии приёмки:**
- [ ] Mid-exam — единственный (только после Блока 5)
- [ ] Принимающий куратор не может быть «своим» (`exam.examiner_id != student.curator_id`)
- [ ] При ❌ — Блок 6 остаётся заблокированным до пересдачи
- [ ] Логи всех попыток в `exams` с timestamp и комментарием

### US-008: Final exam — финальная аттестация у admin

**Как** ученик, прошедший все 10 блоков,
**я хочу** пройти финальный экзамен у admin,
**чтобы** получить статус «Мастер Креста» и доступ к курсу «10 писем».

**Сценарий:**
1. После approval пункта 10 Блока 10 «5 Уверенностей» — финальный экзамен в pending.
2. Получаю push «Готовься к финалу!» с инфо о формате.
3. Admin (super-admin или admin) видит pending в `/admin/exams` → назначает время.
4. Сдаю полный разбор Креста (офлайн или в формате который admin выберет — на старте только офлайн).
5. При ✅ — анимированный полноэкранный попап:

```
🏆 Поздравляем! Теперь вы Мастер Креста.

Поздравляем, возможно, ты уже юноша.

[1 Иоанна 2:14 — «Я написал вам, юноши, потому что вы сильны...»]
```

6. Курс «10 писем» становится доступным (если он уже создан в системе).
7. Видимость расширяется до глобальной — теперь вижу всех учеников платформы.
8. При ❌ — комментарий, пересдача возможна.

**Критерии приёмки:**
- [ ] Финальный экзамен принимает только роль admin или super-admin
- [ ] Анимация ачивки реализована через Framer Motion с motion-блокировкой 3 секунды
- [ ] `course_progress.status = 'completed'`, `final_exam_passed_at = now()`
- [ ] Тригер в БД открывает курс N+1 если он есть в `courses` со статусом `coming_soon`

### US-009: ИИ-тренажёр стихов

**Как** ученик, выучивший местописания блока,
**я хочу** повторять их в тренажёре с интеллектуальной проверкой,
**чтобы** запомнить надолго и не забыть после прохождения блока.

**Сценарий:**
1. Открываю `/m/trainer` → вижу свои выученные стихи (тип `verse_progress.memorized = true`).
2. Тренажёр показывает референс: «Иоанна 19:30». Я печатаю наизусть.
3. ИИ через Anthropic API проверяет:
   - Точное совпадение → ✅ «Идеально»
   - Незначительные опечатки или перефразировка с сохранением смысла → ✅ с комментарием «Засчитано, но точный текст: ...»
   - Существенное отклонение → ❌ «Подучи. Точный текст: ...»
4. Прогресс по стиху: 3 успешных подряд → стих помечается `mastered`.
5. **Гейт:** тренажёр блока N+1 заблокирован пока блок N не сдан полностью.

**Критерии приёмки:**
- [ ] Anthropic Messages API: системный промпт описывает «допускай мелкие опечатки и перефразировку, не допускай искажения смысла»
- [ ] Fallback при недоступности Anthropic — fuzzy match (Levenshtein ≤2) и оценка длины ответа
- [ ] Стоимость на 100 учеников ≈ 10 запросов/день = $0.003 × 1000 = $3/день — приемлемо
- [ ] Тренажёр-gate работает: видны только стихи блоков, которые ученик завершил

### US-010: Двусторонний чат ученик ↔ куратор

**Как** ученик с вопросом по материалу,
**я хочу** написать своему куратору в чат прямо в приложении,
**чтобы** получить ответ без выхода в Telegram.

**Сценарий:**
1. Открываю `/m/chat` → вижу диалог со своим куратором (если других нет — единственный).
2. Пишу: «Не понимаю стих Иоанн 1:1, разве слово было Бог?»
3. Куратор получает push в Telegram + видит сообщение в `/admin/student/:id` (вкладка чат).
4. Отвечает текстом / голосовым / прикрепляет картинку или ссылку.
5. Я получаю push.

**Критерии приёмки:**
- [ ] Чат — это таблица `direct_messages` с полем `attachments JSONB`
- [ ] Реалтайм через Supabase Realtime (subscribe на `direct_messages` где `recipient_id = me`)
- [ ] Voice-сообщения — через MediaRecorder, max 60 сек, хранение в Storage
- [ ] Куратор может писать всем своим ученикам, ученик — только своему куратору

### US-011: Voice-кружок и MediaRecorder

**Как** ученик после практики «Эпохи пятницы» (на улице),
**я хочу** быстро записать голосовое или видео-кружок «как прошло»,
**чтобы** не печатать на ходу.

**Сценарий:**
1. На карточке пункта 11 «Эпоха пятницы» — кнопки: 📝 Текст / 🎥 Кружок / 🎤 Voice.
2. Жму 🎥 → активируется камера через `getUserMedia()`. Кнопка «Запись» (max 60 сек).
3. Запись single-take (никакого монтажа). После остановки — превью + кнопки «Отправить» / «Перезаписать».
4. Загружаю → submission создан с типом `video_circle`. Куратор получает push.

**Критерии приёмки:**
- [ ] MediaRecorder работает в Telegram WebView (тестируется на iOS и Android)
- [ ] Single-take — нет input file, нет монтажа
- [ ] Лимит 60 сек, мягкое уведомление за 10 сек до конца
- [ ] Загрузка в Storage с метаданными (длительность, размер) → ссылка в `submissions.content_url`

### US-012: Видимость учеников по прогрессии

**Как** ученик, прошедший КРЕСТ,
**я хочу** увидеть всех учеников платформы (не только свою группу),
**чтобы** ощутить «семью» большой церкви и видеть масштаб.

**Сценарий:**
1. Пока учусь КРЕСТ — на странице `/m/community` вижу только свою группу (~5-10 человек).
2. После прохождения final exam — обновляется UI, появляется секция «Все Мастера Креста» (без чата по умолчанию, просто список с городами).
3. Если кликну на конкретного человека — могу написать в чат через раздел «Знакомство» (если оба согласны на открытый профиль).

**Критерии приёмки:**
- [ ] PL/pgSQL функция `is_visible_to(viewer_id, target_id)` проверяет: общая группа ИЛИ оба прошли один курс
- [ ] RLS на `profiles` использует эту функцию в `SELECT`
- [ ] При сдаче final exam — UI автоматически обновляется (не нужно перелогиниваться)

### US-013: Раздел «Важно» только для curator+

**Как** куратор, готовящийся к встрече с группой,
**я хочу** получить доступ к Регламенту, Разъяснению и материалам Вопрос-Ответ,
**чтобы** правильно вести группу.

**Сценарий:**
1. Открываю `/admin/important` или `/m/important` (одинаковый раздел).
2. Вижу:
   - 📖 Регламент для кураторов (PDF)
   - 📜 Разъяснение «8 принципов» (PDF)
   - 🎥 Инструкция для лидеров (Kinescope `3iC4NbTjPJro4oWH3RKXpX`)
   - 🎥 Вопрос-Ответ (Kinescope `tCqRddRoFVJ8PEhYeqTKrj`)
   - 📜 Философия раздела (rtf-текст)
3. Учусь, перечитываю.

**Критерии приёмки:**
- [ ] RLS на `important_resources`: SELECT только если `profiles.role IN ('curator', 'admin', 'super_admin')`
- [ ] Ученик пытается зайти `/m/important` → 403 Forbidden, редирект на дашборд

### US-014: Назначение admin / curator с правом передачи прав

**Как** super-admin (Михаил, Алекс, Эля, Игорь),
**я хочу** назначить нового admin или curator из списка существующих пользователей,
**чтобы** масштабировать платформу с новыми городами.

**Сценарий:**
1. На `/admin/content/users` → список всех пользователей с фильтром по роли.
2. Кликаю на ученика, который должен стать куратором.
3. Кнопка «Изменить роль» → выбираю `curator` → подтверждаю.
4. У ученика теперь роль `curator`, открывается `/admin/*` (раздел «Важно», моя группа пока пуста).
5. Назначаю ему первых учеников (`Привязать ученика к куратору`).

**Передача прав super-admin:**
- Super-admin может явно «Передать управление» — выбирает другого пользователя, тот становится super-admin. Текущий — может остаться super-admin или сложить роль (опц.).
- Это критичное действие — двойное подтверждение + email-уведомление обоим.

**Критерии приёмки:**
- [ ] Audit log всех изменений ролей в `role_change_log`
- [ ] Admin не может повысить себя или другого до super-admin
- [ ] Super-admin не может разжаловать другого super-admin без его согласия (только через «Сложить полномочия»)

### US-015: Разблокировка курса 10 писем после Мастера Креста

**Как** ученик, прошедший КРЕСТ,
**я хочу** автоматически получить доступ к курсу «10 писем» (когда он будет готов),
**чтобы** продолжить путь духовного роста.

**Сценарий:**
1. После final exam — `course_progress[user_id, course_id=1].status = 'completed'`.
2. БД-триггер проверяет таблицу `courses`: есть ли курс с `unlock_after_course_id = 1`?
3. Если есть и его статус `active` — создаётся запись `course_progress[user_id, course_id=2].status = 'unlocked'`.
4. Если статус курса `coming_soon` — пользователю показывается «Курс готовится, скоро».
5. На дашборде появляется новая карточка курса.

**Критерии приёмки:**
- [ ] Триггер `BEFORE INSERT OR UPDATE on course_progress` срабатывает на `status = 'completed'`
- [ ] При активации курса (super-admin меняет статус с `coming_soon` на `active`) — все ожидающие пользователи получают push «Курс [N] открыт!»

### US-016: Сертификат об окончании (PDF) — post-MVP

**Как** Мастер Креста,
**я хочу** получить именной PDF-сертификат с моими данными и подписью КРЕСТ,
**чтобы** сохранить как память и поделиться.

**Сценарий:**
1. После final exam — на дашборде появляется кнопка «Получить сертификат».
2. Жму → генерируется PDF через jsPDF: имя, дата, подпись super-admin, водяной знак.
3. Скачиваю или делюсь по ссылке (Storage public URL).

**Статус:** post-MVP. В SPEC v3.0 заложено в схему БД (`certificates`), реализация позже.

### US-017: AI-помощник для ученика — post-MVP

**Как** ученик с вопросом по теме блока,
**я хочу** задать вопрос ИИ-помощнику и получить ответ строго в духе курса КРЕСТ,
**чтобы** не отвлекать куратора по мелочам и быстро разобраться.

**Сценарий:**
1. На карточке пункта 4 (форум-рефлексия) или в чате — кнопка «🤖 Спросить ИИ».
2. Пишу вопрос: «Объясни, что такое 'малый крест' простыми словами».
3. ИИ через Anthropic API отвечает на основе системного промпта с философией КРЕСТ + контекста транскрипций.
4. Если хочу глубже — могу переадресовать вопрос куратору.

**Статус:** post-MVP. Системный промпт и архитектура заложены, реализация когда будет ясна стоимость на типовом потоке.

---

## БЛОК 2: Data Model

### Диаграмма связей (упрощённо)

```
auth.users (Supabase)
       ↓ 1:1
   profiles ──N:1── countries
       │      ──N:1── cities
       │      ──N:1── curator_id (на профиль другого юзера)
       │
       ├──1:N── course_progress ──N:1── courses
       ├──1:N── submissions ──N:1── assignments ──N:1── blocks ──N:1── courses
       ├──1:N── verse_progress ──N:1── bible_verses
       ├──1:N── daily_activity
       ├──1:N── direct_messages (sender) / direct_messages (recipient)
       ├──1:N── exams (subject) / exams (examiner)
       ├──1:N── notifications_log
       └──1:N── role_change_log

courses ──1:N── blocks ──1:N── block_resources
                  ↓
              assignments (12 шаблонов на каждый блок)
                  ↓
              submissions (фактические сдачи учеников)
```

### Таблицы

#### courses (НОВАЯ — мультикурс)

```sql
CREATE TABLE IF NOT EXISTS courses (
  id              SERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  title_ru        TEXT NOT NULL,
  title_en        TEXT,
  description_ru  TEXT,
  order_num       INTEGER NOT NULL,
  unlock_after_course_id INTEGER REFERENCES courses(id),
  status          TEXT NOT NULL DEFAULT 'coming_soon' CHECK (status IN ('active', 'coming_soon', 'archived')),
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

INSERT INTO courses (slug, title_ru, order_num, status)
VALUES ('krest', 'КРЕСТ', 1, 'active');

INSERT INTO courses (slug, title_ru, order_num, unlock_after_course_id, status)
VALUES ('10-pisem', '10 писем', 2, 1, 'coming_soon');
```

#### blocks (расширяем — course_id)

```sql
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id);

-- Удаляем старые 6 блоков, создаём 10 для курса КРЕСТ
DELETE FROM blocks WHERE course_id IS NULL;

INSERT INTO blocks (course_id, order_num, title_ru, slug) VALUES
  (1, 1, 'Малый Крест', 'maly-krest'),
  (1, 2, 'Принцип Сотворения', 'princip-sotvoreniya'),
  (1, 3, 'Коренная Проблема', 'korennaya-problema'),
  (1, 4, 'Состояние Мира', 'sostoyanie-mira'),
  (1, 5, 'Состояние Неверующего', 'sostoyanie-neveruyushchego'),
  (1, 6, 'Усилие Человека', 'usilie-cheloveka'),
  (1, 7, 'Обетования и Исполнение', 'obetovaniya-i-ispolnenie'),
  (1, 8, 'Иисус Христос', 'iisus-khristos'),
  (1, 9, 'Благословения Верующего', 'blagosloveniya-veruyushchego'),
  (1, 10, '5 Уверенностей', '5-uverennostey');

CREATE INDEX IF NOT EXISTS idx_blocks_course_order ON blocks(course_id, order_num);
```

#### block_resources (НОВАЯ)

```sql
CREATE TABLE IF NOT EXISTS block_resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id        INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  resource_type   TEXT NOT NULL CHECK (resource_type IN (
    'main_video', 'additional_video', 'audio_prayer', 'pdf_prayer', 'guide_pdf', 'transcript'
  )),
  title_ru        TEXT NOT NULL,
  kinescope_id    TEXT,         -- для видео
  storage_path    TEXT,         -- для аудио, PDF
  transcript_md   TEXT,         -- для transcript
  order_num       INTEGER DEFAULT 0,
  is_required     BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_block_resources_block_type ON block_resources(block_id, resource_type);

ALTER TABLE block_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY block_resources_select_authenticated ON block_resources FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY block_resources_modify_super_admin ON block_resources FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
```

#### assignments (НОВАЯ — 12-пунктовый шаблон)

```sql
CREATE TABLE IF NOT EXISTS assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id        INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  step_num        INTEGER NOT NULL CHECK (step_num BETWEEN 1 AND 12),
  step_type       TEXT NOT NULL CHECK (step_type IN (
    'preparation', 'main_video', 'additional_video', 'forum_reflection',
    'konspekt', 'daily_cross', 'bible_verses', 'prayer_audio',
    'prayer_daily', 'block_defense', 'epoch_friday', 'daily_report'
  )),
  title_ru        TEXT NOT NULL,
  description_ru  TEXT,
  is_required     BOOLEAN NOT NULL DEFAULT TRUE,
  submission_format TEXT NOT NULL CHECK (submission_format IN (
    'auto', 'text', 'photo', 'video', 'voice', 'manual_approve', 'multi'
  )),
  daily_recurring BOOLEAN DEFAULT FALSE, -- TRUE для пунктов 6, 9, 12
  UNIQUE(block_id, step_num)
);

CREATE INDEX idx_assignments_block_step ON assignments(block_id, step_num);
```

После заливки блоков — каждому блоку создаётся ровно 12 assignments по шаблону. Отличия:
- Пункт 3 (additional_video): `is_required = FALSE` для блоков, где нет дополнительного видео
- Пункт 8 (prayer_audio): `is_required = FALSE` и существует только для Блока 1

#### submissions (НОВАЯ — фактические сдачи ученика)

```sql
CREATE TABLE IF NOT EXISTS submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignment_id   UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE, -- для daily_recurring
  content_text    TEXT,
  content_url     TEXT,         -- ссылка в Storage (фото, видео, voice)
  metadata        JSONB,        -- duration, size, mimetype для медиа
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'auto_approved'
  )),
  reviewer_id     UUID REFERENCES profiles(id),
  reviewer_comment TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- Для не-recurring пунктов — одна сабмишен на ученика
  -- Для recurring — много (каждый день одна)
  CONSTRAINT no_dup_per_day UNIQUE(user_id, assignment_id, submission_date)
);

CREATE INDEX idx_submissions_user_status ON submissions(user_id, status);
CREATE INDEX idx_submissions_pending_review ON submissions(reviewer_id, created_at DESC) WHERE status = 'pending';

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY submissions_select_own_or_curator ON submissions FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid()
    AND (p.role IN ('admin', 'super_admin') OR (p.role = 'curator' AND p.id = (SELECT curator_id FROM profiles WHERE id = submissions.user_id)))
  )
);
CREATE POLICY submissions_insert_own ON submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY submissions_update_curator ON submissions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('curator', 'admin', 'super_admin'))
);
```

#### profiles (ОБНОВЛЯЕМ)

```sql
-- Расширяем роли
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'curator', 'admin', 'super_admin'));

-- Связи с гео и куратором
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_id INTEGER REFERENCES countries(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS curator_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Флаг защищённого владельца (только Михаил на старте)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN profiles.is_protected IS 'Защищён от разжалования/удаления через UI. Изменяется только прямым SQL.';

-- Удаляем устаревшее
ALTER TABLE profiles DROP COLUMN IF EXISTS church_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS gornitsa_type;

CREATE INDEX IF NOT EXISTS idx_profiles_curator ON profiles(curator_id);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON profiles(city_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
```

#### countries, cities (НОВЫЕ)

```sql
CREATE TABLE IF NOT EXISTS countries (
  id              SERIAL PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL, -- ISO 3166-1 alpha-2
  name_ru         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS cities (
  id              SERIAL PRIMARY KEY,
  country_id      INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name_ru         TEXT NOT NULL,
  name_en         TEXT,
  timezone        TEXT NOT NULL DEFAULT 'UTC', -- IANA, для cron-задач
  status          TEXT DEFAULT 'coming_soon' CHECK (status IN ('active', 'coming_soon', 'inactive')),
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_cities_country_status ON cities(country_id, status);

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY countries_select_all ON countries FOR SELECT USING (TRUE);
CREATE POLICY cities_select_all ON cities FOR SELECT USING (TRUE);
CREATE POLICY countries_modify_super_admin ON countries FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY cities_modify_super_admin ON cities FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Seed гео (на старте — Бали активный, остальные coming_soon)
INSERT INTO countries (code, name_ru, name_en) VALUES
  ('RU', 'Россия', 'Russia'),
  ('ID', 'Индонезия', 'Indonesia'),
  ('TH', 'Тайланд', 'Thailand'),
  ('AE', 'ОАЭ', 'UAE'),
  ('GE', 'Грузия', 'Georgia'),
  ('IL', 'Израиль', 'Israel'),
  ('BY', 'Беларусь', 'Belarus'),
  ('US', 'США', 'USA'),
  ('VN', 'Вьетнам', 'Vietnam')
ON CONFLICT (code) DO NOTHING;

-- Бали — единственный active
INSERT INTO cities (country_id, name_ru, timezone, status) VALUES
  ((SELECT id FROM countries WHERE code = 'ID'), 'Бали', 'Asia/Makassar', 'active'),
  ((SELECT id FROM countries WHERE code = 'TH'), 'Пхукет', 'Asia/Bangkok', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'AE'), 'Дубай', 'Asia/Dubai', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'GE'), 'Тбилиси/Батуми', 'Asia/Tbilisi', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'IL'), 'Нагария', 'Asia/Jerusalem', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'BY'), 'Минск', 'Europe/Minsk', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'US'), 'Лас-Вегас', 'America/Los_Angeles', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'US'), 'Лос-Анжелес', 'America/Los_Angeles', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'VN'), 'Дананг', 'Asia/Bangkok', 'coming_soon');

-- Россия (19 городов, все coming_soon на старте)
INSERT INTO cities (country_id, name_ru, timezone, status) VALUES
  ((SELECT id FROM countries WHERE code = 'RU'), 'Москва', 'Europe/Moscow', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Санкт-Петербург', 'Europe/Moscow', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Кемерово', 'Asia/Krasnoyarsk', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Екатеринбург', 'Asia/Yekaterinburg', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Томск', 'Asia/Tomsk', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Омск', 'Asia/Omsk', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Тюмень', 'Asia/Yekaterinburg', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Ярославль', 'Europe/Moscow', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Калининград', 'Europe/Kaliningrad', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Сочи', 'Europe/Moscow', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Нижний Новгород', 'Europe/Moscow', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Ростов', 'Europe/Moscow', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Иркутск', 'Asia/Irkutsk', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Казань', 'Europe/Moscow', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Калуга', 'Europe/Moscow', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Пермь', 'Asia/Yekaterinburg', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Уфа', 'Asia/Yekaterinburg', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Челябинск', 'Asia/Yekaterinburg', 'coming_soon'),
  ((SELECT id FROM countries WHERE code = 'RU'), 'Таганрог', 'Europe/Moscow', 'coming_soon');
```

#### course_progress (НОВАЯ)

```sql
CREATE TABLE IF NOT EXISTS course_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id       INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'unlocked' CHECK (status IN (
    'locked', 'unlocked', 'in_progress', 'completed'
  )),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  final_exam_passed_at TIMESTAMPTZ,
  UNIQUE(user_id, course_id)
);

CREATE INDEX idx_course_progress_user ON course_progress(user_id);

ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_progress_select_visible ON course_progress FOR SELECT USING (
  user_id = auth.uid() OR is_visible_to(auth.uid(), user_id)
);
```

#### exams (НОВАЯ)

```sql
CREATE TABLE IF NOT EXISTS exams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam_type       TEXT NOT NULL CHECK (exam_type IN ('block', 'mid', 'final')),
  block_id        INTEGER REFERENCES blocks(id), -- для type='block' и 'mid'
  course_id       INTEGER REFERENCES courses(id), -- для type='final'
  examiner_id     UUID REFERENCES profiles(id),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'scheduled', 'passed', 'failed'
  )),
  scheduled_at    TIMESTAMPTZ,
  attempted_at    TIMESTAMPTZ,
  passed_at       TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  comment         TEXT,
  attempt_num     INTEGER DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_exams_user_type ON exams(user_id, exam_type);
CREATE INDEX idx_exams_pending_examiner ON exams(examiner_id, created_at DESC) WHERE status = 'pending';

-- Для mid-exam: examiner != student.curator_id (валидация в API/триггер)

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY exams_select_subject_or_examiner_or_admin ON exams FOR SELECT USING (
  user_id = auth.uid()
  OR examiner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
```

#### daily_activity (НОВАЯ — для дневного календаря)

```sql
CREATE TABLE IF NOT EXISTS daily_activity (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date                        DATE NOT NULL,
  logged_in                       BOOLEAN DEFAULT FALSE,
  daily_report_submitted          BOOLEAN DEFAULT FALSE,
  daily_cross_photo_submitted     BOOLEAN DEFAULT FALSE,
  bible_verse_recorded            BOOLEAN DEFAULT FALSE,
  prayer_marked                   BOOLEAN DEFAULT FALSE,
  epoch_friday_reported           BOOLEAN DEFAULT FALSE,
  total_submissions_count         INTEGER DEFAULT 0,
  approved_submissions_count      INTEGER DEFAULT 0,
  last_activity_at                TIMESTAMPTZ,
  UNIQUE(user_id, log_date)
);

CREATE INDEX idx_daily_activity_user_date ON daily_activity(user_id, log_date DESC);

ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_activity_select_visible ON daily_activity FOR SELECT USING (
  user_id = auth.uid() OR is_visible_to(auth.uid(), user_id)
);
```

#### direct_messages (НОВАЯ — чат)

```sql
CREATE TABLE IF NOT EXISTS direct_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_text    TEXT,
  attachments     JSONB,        -- [{ type: 'voice'|'photo', url, duration }]
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CHECK (sender_id != recipient_id)
);

CREATE INDEX idx_dm_recipient_unread ON direct_messages(recipient_id, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX idx_dm_thread ON direct_messages(LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at DESC);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY dm_select_participants ON direct_messages FOR SELECT USING (
  sender_id = auth.uid() OR recipient_id = auth.uid()
);
CREATE POLICY dm_insert_own ON direct_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());
```

#### bible_verses + verse_progress (расширяем)

```sql
ALTER TABLE bible_verses ADD COLUMN IF NOT EXISTS block_id INTEGER REFERENCES blocks(id);
ALTER TABLE bible_verses ADD COLUMN IF NOT EXISTS reference_short TEXT; -- "Ин 1:1"
ALTER TABLE bible_verses ADD COLUMN IF NOT EXISTS text_full TEXT;

CREATE TABLE IF NOT EXISTS verse_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  verse_id        UUID NOT NULL REFERENCES bible_verses(id) ON DELETE CASCADE,
  attempts_count  INTEGER DEFAULT 0,
  successful_in_row INTEGER DEFAULT 0,
  mastered        BOOLEAN DEFAULT FALSE,
  last_attempt_at TIMESTAMPTZ,
  UNIQUE(user_id, verse_id)
);
```

#### notifications_log (как было, минор-правки)

```sql
-- Существующая таблица, добавим тип уведомлений
ALTER TABLE notifications_log ADD COLUMN IF NOT EXISTS notification_type TEXT;
-- Возможные: 'submission_new', 'silence_alert', 'block_unlocked', 'exam_pending', etc
```

#### important_resources (НОВАЯ — раздел «Важно»)

```sql
CREATE TABLE IF NOT EXISTS important_resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type   TEXT NOT NULL CHECK (resource_type IN (
    'pdf', 'kinescope_video', 'text_md'
  )),
  title_ru        TEXT NOT NULL,
  storage_path    TEXT,
  kinescope_id    TEXT,
  content_md      TEXT,
  order_num       INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE important_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY important_select_curator_plus ON important_resources FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('curator', 'admin', 'super_admin'))
);
CREATE POLICY important_modify_super_admin ON important_resources FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
```

#### role_change_log (НОВАЯ — audit)

```sql
CREATE TABLE IF NOT EXISTS role_change_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_role        TEXT NOT NULL,
  new_role        TEXT NOT NULL,
  changed_by      UUID NOT NULL REFERENCES profiles(id),
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_role_changes_user ON role_change_log(changed_user_id, created_at DESC);
```

### Функция видимости (PL/pgSQL)

```sql
CREATE OR REPLACE FUNCTION is_visible_to(viewer_id UUID, target_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
  viewer_role TEXT;
  target_curator UUID;
  viewer_curator UUID;
BEGIN
  SELECT role INTO viewer_role FROM profiles WHERE id = viewer_id;

  -- Admin / super-admin видят всех
  IF viewer_role IN ('admin', 'super_admin') THEN
    RETURN TRUE;
  END IF;

  -- Куратор видит своих учеников + других кураторов своего города
  IF viewer_role = 'curator' THEN
    IF target_id IN (SELECT id FROM profiles WHERE curator_id = viewer_id) THEN
      RETURN TRUE;
    END IF;
    -- Другие кураторы того же города
    IF EXISTS (SELECT 1 FROM profiles WHERE id = target_id AND role = 'curator' AND city_id = (SELECT city_id FROM profiles WHERE id = viewer_id)) THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Сам себя
  IF viewer_id = target_id THEN
    RETURN TRUE;
  END IF;

  -- Студент: видит свою группу (одного куратора)
  SELECT curator_id INTO viewer_curator FROM profiles WHERE id = viewer_id;
  SELECT curator_id INTO target_curator FROM profiles WHERE id = target_id;
  IF viewer_curator IS NOT NULL AND viewer_curator = target_curator THEN
    RETURN TRUE;
  END IF;

  -- Прогрессия: оба прошли один и тот же курс
  IF EXISTS (
    SELECT 1 FROM course_progress cp1
    JOIN course_progress cp2 ON cp1.course_id = cp2.course_id
    WHERE cp1.user_id = viewer_id AND cp1.status = 'completed'
      AND cp2.user_id = target_id AND cp2.status = 'completed'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;
```

### Функция «блок завершён»

```sql
CREATE OR REPLACE FUNCTION is_block_completed(p_user_id UUID, p_block_id INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
  required_count INTEGER;
  approved_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO required_count
  FROM assignments
  WHERE block_id = p_block_id AND is_required = TRUE;

  SELECT COUNT(DISTINCT a.id) INTO approved_count
  FROM assignments a
  JOIN submissions s ON s.assignment_id = a.id
  WHERE a.block_id = p_block_id
    AND a.is_required = TRUE
    AND s.user_id = p_user_id
    AND s.status IN ('approved', 'auto_approved')
    AND (
      NOT a.daily_recurring -- однократные пункты — одно одобрение
      OR (
        a.daily_recurring -- recurring пункты — минимум 7 дней одобренных
        AND (SELECT COUNT(DISTINCT submission_date) FROM submissions WHERE assignment_id = a.id AND user_id = p_user_id AND status IN ('approved', 'auto_approved')) >= 7
      )
    );

  RETURN approved_count >= required_count;
END;
$$;
```

### Триггеры

```sql
-- Универсальный updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- (аналогично для остальных)

-- Auto-unlock следующего курса после completion
CREATE OR REPLACE FUNCTION trigger_unlock_next_course()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_course_id INTEGER;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    SELECT id INTO next_course_id FROM courses
    WHERE unlock_after_course_id = NEW.course_id AND status = 'active';

    IF next_course_id IS NOT NULL THEN
      INSERT INTO course_progress (user_id, course_id, status)
      VALUES (NEW.user_id, next_course_id, 'unlocked')
      ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'unlocked';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_unlock_next_course AFTER UPDATE ON course_progress
  FOR EACH ROW EXECUTE FUNCTION trigger_unlock_next_course();
```

### Удалено из v2.0

- `churches`
- `pastor_subscriptions`
- `cohorts` + `cohort_members`
- `streak_logs` (заменено на `daily_activity`)
- `block_rejections` (стало частью `submissions.status='rejected'`)

---

## БЛОК 3: API Endpoints

Стандарт ответов:
- Успех: `{ "ok": true, "data": {...}, "meta": {...} }`
- Ошибка: `{ "error": { "code": "ERROR_CODE", "message": "..." } }`
- HTTP-коды: 200 / 201 / 400 / 401 / 403 / 404 / 500

### Регистрация / Auth

#### `POST /api/auth/register-student`
Регистрация ученика с гео и куратором.
**Запрос:**
```json
{ "name": "Алина", "email": "alina@example.com", "password": "...",
  "country_id": 2, "city_id": 1, "curator_id": "uuid",
  "telegram_username": "@alina", "referral_source": "Instagram" }
```
**Ответ 200:** `{ ok: true, data: { user_id, redirect_to: "/m/dashboard" } }`
**Ошибки:** 400 (city.status='coming_soon' → 'CITY_NOT_ACTIVE'), 400 ('CURATOR_NOT_IN_CITY')

### Куратор

#### `GET /api/curator/group`
Список своих учеников.
**Ответ:** `{ data: [{ id, name, blocks_completed, last_activity_at, alerts: ['silent_2_days'] }] }`

#### `GET /api/curator/calendar?week=2026-W18`
Дневной календарь группы.
**Ответ:** массив `daily_activity` за 7 дней по каждому ученику.

#### `POST /api/curator/students/add`
Добавить ученика в свою группу.
**Запрос:** `{ name, telegram_username?, email?, contact? }`
**Ответ:** ссылка-приглашение или подтверждение что ученик добавлен.

#### `POST /api/curator/submission/approve`
**Запрос:** `{ submission_id, comment?: string }`

#### `POST /api/curator/submission/reject`
**Запрос:** `{ submission_id, comment: string (мин 10 симв) }`

### Ученик

#### `POST /api/student/submission`
Создать новую submission.
**Запрос:** `{ assignment_id, content_text?, content_url?, metadata? }`
**Ответ:** `{ data: { submission_id, status: "pending" } }`
Триггер: push куратору в Telegram.

#### `GET /api/student/block/:id`
Полная карточка блока с 12 пунктами и текущим статусом ученика.
**Ответ:**
```json
{ data: {
  block: { id, order_num, title_ru, course_id },
  resources: [{ resource_type, ... }],
  assignments: [
    { id, step_num, step_type, title_ru, is_required, my_submissions: [...] },
    ...
  ],
  is_completed: false,
  required_remaining: 3
}}
```

#### `POST /api/student/block/:id/ready-to-defend`
Ученик готов сдавать блок (пункт 10).
Триггер: push куратору.

### Экзамены

#### `POST /api/exam/request-mid`
Запросить промежуточный экзамен (после Блока 5).

#### `POST /api/exam/:id/pass`
Принимающий куратор/admin ставит ✅.

#### `POST /api/exam/:id/fail`
**Запрос:** `{ comment: string }`

### ИИ-тренажёр

#### `POST /api/trainer/check`
**Запрос:** `{ verse_id, user_attempt: string }`
**Логика:** через Anthropic Messages API. Системный промпт оценивает близость к оригиналу.
**Ответ:**
```json
{ data: {
  verdict: "approved" | "approved_with_notes" | "rejected",
  feedback: "Засчитано, но точный текст: ...",
  show_correct: true,
  correct_text: "..."
}}
```

### Чат

#### `GET /api/chat/messages?with=:user_id`
История переписки.

#### `POST /api/chat/send`
**Запрос:** `{ recipient_id, content_text?, attachments? }`
Триггер: push получателю.

### Admin

#### `POST /api/admin/role/grant`
**Запрос:** `{ user_id, new_role, reason? }`
Триггер: запись в `role_change_log`.

#### `POST /api/admin/role/transfer-super-admin`
**Запрос:** `{ to_user_id, keep_my_role: boolean }`
Двойное подтверждение через email.

#### `POST /api/admin/student/attach-curator`
**Запрос:** `{ student_id, curator_id }`

#### `POST /api/admin/city/upsert`
**Запрос:** `{ name_ru, country_id, timezone, status }`
Только super-admin.

#### `GET /api/admin/analytics?scope=city|country|global`
Heatmap, конверсия по блокам, лидерборд кураторов.

### Cron / Background

#### `POST /api/cron/silence-check` (раз в час)
Идёт по `daily_activity` за прошлые сутки в timezone городов. Если за день нет отчёта — push куратору. Если 3+ дня — эскалация.

#### `POST /api/cron/daily-summary` (07:00 timezone куратора)
Дайджест всем кураторам: «Вчера у вас X сабмишенов, Y тишин, Z готовых сдавать».

### Уведомления (Telegram)

#### `POST /api/notify/telegram`
Внутренний — отправка push куратору или ученику. Логируется в `notifications_log`.

---

## БЛОК 4: UI/UX

(Краткий обзор. Детали — в `UI_UX_BRIEF.md`, который обновляется на следующем шаге Этапа А.)

### Лендинг (`/`)

**Hero (тёмный, full viewport):**
- Cursor glow эффект — radial gradient следующий за мышью
- Фон: изображение «небеса + светящийся крест» (Midjourney)
- Заголовок: «КРЕСТ» крупным шрифтом
- Подзаголовок: «Великое Поручение Иисуса Христа»
- Цитата: «Матфея 28:18-20 — Итак идите, научите все народы»
- Цифры: **237 стран • 5000 народностей • 7000 горниц • 7000 учеников**
- CTA: «Войти» / «Узнать больше»
- Скролл-indicator вниз

**Дальше (светлые секции с тёмными акцентами):**
- Что такое КРЕСТ — короткое описание для ищущих
- Как это работает — 12 пунктов ДЗ под руководством куратора, 10 блоков, ачивка «Мастер Креста»
- Видение — 3 курса (КРЕСТ → 10 писем → 20 писем), масштаб «евангелизация всех народов»
- Команда — фото super-admin'ов
- CTA снизу: «Найти куратора в своём городе»

### MiniApp (`/m/*`) — для Telegram + браузера

#### `/m/onboarding` — пошаговый
Шаги: язык → страна → город → куратор → личные данные → email-подтверждение → дашборд.

#### `/m/dashboard`
- Header: аватар + имя + город
- Карточка курса КРЕСТ с прогресс-баром «3 из 10 блоков»
- Список 10 блоков (карточки) с состояниями: locked / unlocked / in_progress / completed
- Если есть mid-exam в pending — pulse-карточка «⭐ Готовься к экзамену»
- Кнопка «Тренажёр стихов» (gate: только разблокированные блоки)
- Кнопка «Чат с куратором»

#### `/m/lesson/[blockId]`
- Header: «Блок 1: Малый Крест»
- 12 карточек-пунктов с иконками статуса (🔒/⏳/📝/✅/🔄)
- Каждая карточка раскрывается: описание + UI для submission
- Внизу — индикатор «Все обязательные пройдены — готов сдавать»

#### `/m/trainer`
- Список разблокированных стихов (по блокам)
- Кнопка «Тренироваться» → переход к интерактивному тренажёру с ИИ-проверкой

#### `/m/chat`
- Один диалог со своим куратором (всегда)
- Если ученик прошёл КРЕСТ — может появляться больше контактов

#### `/m/important` — раздел «Важно»
- Доступен только curator+
- Карточки: Регламент.pdf, Разъяснение.pdf, Инструкция-видео, Вопрос-Ответ-видео

### Веб-админка куратора (`/admin/*`)

#### `/admin/dashboard`
- Header: имя + город
- Метрики: активных учеников / в pending review / алерты тишины
- Лента последних сабмишенов с быстрыми Approve/Reject

#### `/admin/group`
- Таблица учеников: имя, блок, последняя активность, % одобренных пунктов
- Кнопка «Добавить ученика»

#### `/admin/calendar`
- Таблица: ученики × дни недели
- Иконки активности в каждой ячейке
- Алерт-бар сверху

#### `/admin/student/:id`
- Полная карточка ученика
- Все его сабмишены, статусы, история одобрений
- Чат-вкладка
- Кнопки одобрения / отклонения

#### `/admin/exams`
- Pending экзамены (block, mid, final)
- Распределение mid-exam к другому куратору

#### `/admin/important`
- Тот же раздел что и `/m/important`, в desktop-версии

#### `/admin/content` — только super-admin
- Управление городами (CRUD)
- Управление пользователями (роли, прикрепление учеников)
- Управление контентом блоков (видео-ID, ресурсы)
- Управление курсами (active / coming_soon)

### Дизайн-система

См. `UI_UX_BRIEF.md` для:
- Цветовая палитра (light + dark accents)
- Типографика (Geist Sans + serif для заголовков)
- Размеры, отступы, радиусы
- Компоненты shadcn/ui — какие используем, как кастомизируем
- Анимации Framer Motion (cursor glow, page transitions, scroll reveals)
- Иконки Lucide
- Иллюстрации (Midjourney промпты)

---

## БЛОК 5: Business Logic

### Lesson flow по 12 пунктам

См. `memory/project_lesson_model_v2.md` — финальная модель.

Ключевые правила:
- Пункты последовательны: чтобы сдать пункт N+1 (где требуется предыдущий), нужно завершить N
- Пункт 6 (писать крест ежедневно) — daily recurring, нужно 7 уникальных дней с фото
- Пункт 12 (ежедневный отчёт) — daily recurring, 7 дней
- Пункт 9 (молитва) — daily recurring, на доверии (галочки)
- Пункт 10 (сдача) — последний обязательный, открывается только после всех остальных ✅

### Block gate

Функция `is_block_completed(user_id, block_id)`:
- Проверяет что **все** обязательные assignments одобрены
- Для recurring пунктов — минимум 7 уникальных дней одобренных submissions
- При TRUE → разблокируется следующий блок (через триггер `trigger_unlock_next_block`)

### Course gate

После approval пункта 10 Блока 10 → создаётся `exam` типа `final` в pending. После passing → `course_progress.status = 'completed'` → триггер `trigger_unlock_next_course` создаёт `course_progress` для следующего курса (если есть в `courses` со статусом `active`) или ставит `pending_course_activation`.

### Mid-exam после Блока 5

После approval пункта 10 Блока 5 → создаётся `exam` типа `mid` в pending. Блок 6 заблокирован пока не сдано. Принимающий куратор не может быть `student.curator_id` (валидация в `/api/admin/exam/assign-examiner`).

### Visibility

См. функцию `is_visible_to(viewer_id, target_id)` в БЛОКЕ 2. Используется в RLS политиках для `profiles`, `course_progress`, `daily_activity`.

### ИИ-проверка стихов через Anthropic

**Системный промпт:**
```
Ты проверяешь знание стиха Библии наизусть. Эталонный текст:
[verse.text_full]
Реф: [verse.reference]

Пользователь ввёл: [user_attempt]

Оцени по шкале:
- "approved" — точное совпадение, мелкие опечатки до 2 символов, пунктуация
- "approved_with_notes" — небольшая перефразировка с сохранением полного смысла
- "rejected" — существенное искажение смысла, пропуск ключевых слов, или текст отличается значительно

Верни JSON: { "verdict": "...", "feedback": "одно предложение почему", "differences": [...] }
```

**Fallback** при недоступности Anthropic:
- Levenshtein distance ≤2 → approved
- ≤10% символов — approved_with_notes
- Иначе rejected

**Бюджет:** ~$0.003 per request (Sonnet 4.6, ~500 токенов в среднем). 100 учеников × 10 запросов/день = $3/день = $90/мес.

### Ролевая иерархия и назначение

| Кто | Может назначить | Может разжаловать |
|---|---|---|
| super_admin | admin, curator, student | admin, curator (не другого super_admin без согласия; **никогда — пользователя с `is_protected=TRUE`**) |
| admin | curator (в своей зоне), student | curator (в своей зоне) |
| curator | student (взять в свою группу) | — |

«Передача управления» super-admin: явное действие через UI с двойным подтверждением.

**`is_protected` (защита владельца):** API endpoint `/api/admin/role/grant` возвращает 403 при попытке изменить роль или удалить пользователя с `is_protected=TRUE`. Эта защита снимается только прямым SQL `UPDATE profiles SET is_protected=FALSE WHERE id='...'` через Supabase Studio (намеренно неудобно).

### Назначение учеников куратору

- При регистрации ученик сам выбирает куратора в шаге 4 онбординга
- super_admin / admin могут потом перепривязать ученика через `/api/admin/student/attach-curator`
- При перепривязке submissions, экзамены, daily_activity — остаются с прежним reviewer_id, но новые сдачи идут к новому куратору

### Внешние интеграции

**Telegram Bot API:**
- Push-уведомления (текст + кнопки), `chat_id, text, parse_mode: 'HTML', reply_markup`
- Создание deep-link приглашений
- HMAC-валидация `initData` для авторизации в MiniApp

**Kinescope:**
- Видео embed через iframe с параметрами `controls=1&showLogo=0`
- Кастомный no-skip overlay (свой polling currentTime)
- CSP в next.config.ts: `frame-src https://kinescope.io`

**Resend SMTP:**
- Email-подтверждение регистрации
- Восстановление пароля
- Уведомления о смене роли (для transfer-super-admin)

**Anthropic Messages API:**
- Только тренажёр стихов (на старте)
- AI-помощник для ученика — post-MVP

**Supabase:**
- Auth (email/password)
- PostgreSQL с RLS
- Storage (buckets: `student-submissions`, `block-resources`, `important-resources`)
- Realtime (для chat)

### Безопасность

| Аспект | Реализация |
|---|---|
| Аутентификация | Supabase Auth (email/password) |
| Авторизация | RLS на всех таблицах |
| Валидация ввода | Zod-схемы во всех API routes |
| Rate limiting | Vercel Edge Config (60 req/min на IP) |
| CORS | Strict origin для API |
| XSS | Студенческий ввод → `textContent`, лидерский → `innerHTML` (sanitized) |
| CSRF | SameSite cookies + проверка Origin header |
| Telegram WebApp validation | Verify `initData` через HMAC SHA256 + bot token |
| Maintenance mode | Whitelist по chat_id или `?bypass=` token |

### Cron-задачи

| Задача | Расписание | Что делает |
|---|---|---|
| `silence-check` | каждый час | Проверяет `daily_activity` за прошлые сутки в TZ городов; пуши куратору |
| `daily-summary` | 07:00 в TZ куратора | Дайджест куратору за вчера |
| `archive-old-data` | 03:00 МСК еженедельно | Архивирует submissions старше 6 месяцев в холодное хранилище |

---

## БЛОК 6: Edge Cases (15+)

### Сеть и доступность

| # | Ситуация | Поведение |
|---|---|---|
| 1 | Пропала сеть во время загрузки кругляшка | Сохранить blob в IndexedDB, retry при восстановлении, toast «Загружается…» |
| 2 | Telegram Bot API недоступен | Запись в `notifications_log status='failed'`, retry 3 раза, показать в UI «Уведомление не отправлено, попробуй позже» |
| 3 | Anthropic API возвращает 5xx или таймаут | Fallback на Levenshtein-проверку, тренажёр работает дальше |
| 4 | Kinescope iframe не загрузился | Fallback экран «Видео временно недоступно, попробуй позже» + кнопка обновить |
| 5 | Supabase Realtime отвалился (chat) | Fallback на polling каждые 10 сек, индикатор «оффлайн» |

### Данные и состояние

| # | Ситуация | Поведение |
|---|---|---|
| 6 | Куратор уходит / увольняется | super-admin может перепривязать всех его учеников к другому куратору одной кнопкой; submissions с прежним reviewer_id остаются |
| 7 | Ученик переехал в другой город | super-admin меняет `city_id`, опц. перепривязывает к новому куратору |
| 8 | Конкурентное одобрение (два куратора одновременно) | Optimistic UPDATE, последний выигрывает, в UI показываем кто одобрил |
| 9 | Ученик пытается сдать пункт 10 без всех ✅-пунктов | UI блокирует кнопку, API возвращает 400 'BLOCK_NOT_READY' |
| 10 | Дубликат @username при добавлении ученика куратором | API возвращает 409 'STUDENT_EXISTS', куратор может «попросить привязать» (отправить рекомендацию) |

### Безопасность

| # | Ситуация | Поведение |
|---|---|---|
| 11 | Ученик подменяет block_id в URL | RLS + проверка `is_block_unlocked(user_id, block_id)` → 403 + редирект на дашборд |
| 12 | Ученик пытается видеть другого ученика без права | RLS на `profiles` через `is_visible_to()` → 0 строк, фронт показывает «Не найдено» |
| 13 | Prompt injection в форум-рефлексии или voice transcript | Sanitize HTML (DOMPurify) + escape в Telegram-уведомлениях |
| 14 | Ученик пытается одобрить свой submission | RLS → 403; submissions_update_curator проверяет роль не student |

### Лимиты и производительность

| # | Ситуация | Поведение |
|---|---|---|
| 15 | Voice/video > 100 МБ | Жёсткий лимит на сервере, отказ с 'FILE_TOO_LARGE' |
| 16 | Куратор открывает группу 100+ учеников | Пагинация по 20 + виртуализация при scroll |
| 17 | Massive Telegram-рассылка (silence-check) | Throttling 30 msg/sec, очередь через `notifications_log status='queued'` |

### Время и часовые пояса

| # | Ситуация | Поведение |
|---|---|---|
| 18 | Ученик из Москвы, куратор на Бали | Daily-cron работает по `cities.timezone` ученика |
| 19 | Submission в 23:59 МСК | Засчитывается за день отправки (UTC сохраняется в БД, отображается в TZ ученика) |

### Ролевая иерархия

| # | Ситуация | Поведение |
|---|---|---|
| 20 | super_admin теряет доступ (увольнение, утрата email) | Другой super_admin может разжаловать через специальную кнопку с двойным подтверждением + audit log |
| 21 | Admin пытается повысить себя в super_admin | API 403 'INSUFFICIENT_PRIVILEGES' |

---

## Приложение: что меняется vs SPEC v2.0

### ❌ Удалено

- B2B-модель (`churches`, `pastor_subscriptions`, ЮKassa, лендинг с pricing)
- 6-блочный курс (заменён на 10)
- Vanilla MiniApp архитектура (всё на Next.js)
- 3-вопросов-форум (расширен до 12 пунктов ДЗ)
- Streak-механика Duolingo-стиля (заменена на дневной календарь куратора)
- Cohorts auto-join (заменено на ручную привязку куратор-ученик)
- Lang-constraint в схеме (только русский на старте)
- Видеосозвон в платформе

### ✅ Добавлено

- Мультикурсовая архитектура (`courses`, `course_progress`)
- Гео-структура (`countries`, `cities`) с CRUD в админке
- 4-уровневая ролевая иерархия с правом передачи
- 12-пунктовое ДЗ (`assignments`, `submissions`)
- Block-gate + mid-exam (после Блока 5) + final-exam (`exams`)
- Дневной календарь куратора (`daily_activity`)
- Двусторонний чат (`direct_messages`)
- ИИ-тренажёр через Anthropic
- Видимость по прогрессии (`is_visible_to()`)
- Раздел «Важно» для curator+ (`important_resources`)
- Ачивки в библейском стиле (1 Иоанна 2:12-14)
- Дизайн-направление (тема C, superhuman ref)
- Аудит ролевых изменений (`role_change_log`)

### 🔄 Изменено

- `profiles`: расширены роли, привязка к city/country/curator
- `blocks`: course_id, точные 10 заголовков
- `block_resources`: новая структура с типами (main_video, additional_video, audio_prayer, pdf_prayer, guide_pdf)
- `bible_verses` + `verse_progress`: расширены под ИИ-тренажёр

---

*Версия 3.0 | Дата: 2026-05-01 | Spec-First Pipeline шаг 4/9 | Замещает SPEC v2.0*
