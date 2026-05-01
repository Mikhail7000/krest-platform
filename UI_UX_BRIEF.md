# КРЕСТ — UI/UX Brief v3.0

> Версия: 3.0 | Дата: 2026-05-01 | Замещает v1.0 полностью.
> Дизайн-система для лендинга, Telegram MiniApp и веб-админки. Один Next.js проект, три аудитории.

---

## 1. Концепция и tone of voice

### Стиль одной фразой

**«Современный минимализм с премиальным wow-моментом в hero. Без тени церковной эстетики».**

### Что ДА

- Светлый, чистый, просторный
- Премиальные тёмные акценты (как «оазисы» внутри светлого сайта)
- Крупная выразительная типографика
- Плавные анимации Framer Motion
- Cursor glow эффект на тёмных секциях (как у superhuman.com)
- Минимум визуального шума, максимум воздуха
- Серьёзность через сдержанность, а не пафос

### Что НЕТ

- ❌ Золото / готические шрифты / орнаменты / иконы / арки
- ❌ Любой намёк на «русский православный сайт»
- ❌ Стоковые «руки в небо», «закат с крестом», «открытая Библия»
- ❌ Цвета: насыщенный синий, бордо, церковное золото
- ❌ Многословные заголовки, длинные параграфы

### Tone of voice (текст в UI)

- **Уважительный, но без пафоса.** Как умный друг, который объясняет важное.
- **Конкретный, не абстрактный.** «12 пунктов ДЗ» — да. «Путь духовного развития» — нет (или только в одном-двух местах для смыслового акцента).
- **Прямой, не извинительный.** «Сдай куратору» — да. «Не могли бы вы попробовать сдать вашему куратору?» — нет.
- **Современный, не архаичный.** Слова «горница», «капсула», «эпоха пятницы» — это терминология **внутри курса** (на дашборде, в задачах), но не на лендинге. Лендинг говорит языком 2026.

### Целевая аудитория

| Аудитория | Где сидит | Что ценит |
|---|---|---|
| Ученик-новичок (18-45) | Telegram MiniApp на телефоне в дороге | Быстрая навигация, понятный прогресс, минимум текста |
| Куратор / лидер горницы | Веб-админка на ноутбуке | Видеть всю группу разом, точечная обратная связь, не залипать в UI |
| Super-admin (Михаил, Алекс, Эля, Игорь) | Веб-админка | Аналитика, управление городами/ролями, обзор всей платформы |
| Случайный посетитель лендинга | Браузер | Понять что это за платформа за 10 секунд |

### Главные референсы

| # | Сайт | Что берём |
|---|---|---|
| 1 | **superhuman.com** | Primary — премиальный тёмный hero, cursor glow, чистый минимализм |
| 2 | linear.app | Типографика, плавные scroll-переходы |
| 3 | vercel.com | Крупные числа, минимальные кнопки |
| 4 | apple.com/iphone | Wow-параллакс при скролле |
| 5 | arc.net | Большая типографика в hero |

### Анти-референсы

- Любой сайт прихода с куполами и витражами в шапке
- Wordpress-темы для церквей с слайдером псалмов
- Стоковая фотография «верующих с поднятыми руками»

---

## 2. Цветовая палитра

### Принцип: **тема C — светлый с тёмными акцентами**

Основной сайт светлый. Hero лендинга и опциональные «эмоциональные секции» — тёмные оазисы. Темная и светлая темы поддерживаются обе (переключение по системным настройкам пользователя), но светлая — основная.

### Tailwind v4 @theme

```css
@theme {
  /* === SURFACES (light, default) === */
  --color-bg: #FFFFFF;                    /* основной фон страниц */
  --color-bg-subtle: #FAFAFA;             /* секции-зебры */
  --color-bg-card: #FFFFFF;               /* карточки */
  --color-bg-elevated: #F5F5F4;           /* hover, dropdowns */

  /* === SURFACES dark (для hero и dark theme) === */
  --color-bg-dark: #0A0A0A;               /* тёмный фон */
  --color-bg-dark-card: #18181B;          /* тёмная карточка */
  --color-bg-dark-elevated: #27272A;

  /* === TEXT === */
  --color-text: #0A0A0A;                  /* основной текст light */
  --color-text-muted: #71717A;            /* вторичный, hint */
  --color-text-on-dark: #FAFAFA;          /* текст на тёмном фоне */
  --color-text-muted-on-dark: #A1A1AA;

  /* === BORDERS === */
  --color-border: #E5E5E5;                /* light */
  --color-border-strong: #D4D4D4;
  --color-border-on-dark: #27272A;

  /* === ACCENT (минимальный, нейтральный) === */
  --color-accent: #18181B;                /* почти чёрный — это и есть «акцент» в минимализме */
  --color-accent-hover: #000000;
  --color-accent-on-dark: #FAFAFA;        /* белый акцент на тёмном */

  /* === STATES === */
  --color-success: #16A34A;               /* зелёный — одобрено, gate пройден */
  --color-warning: #EAB308;               /* жёлтый — алерт куратора */
  --color-error: #DC2626;                 /* красный — отклонено, ошибка */
  --color-info: #0284C7;                  /* синий — info, inline help */

  /* === GLOW (для cursor glow, hero) === */
  --color-glow: rgba(255, 255, 255, 0.08); /* белое сияние на тёмном */
  --color-glow-strong: rgba(255, 255, 255, 0.18);

  /* === ELEVATION === */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.10);
  --shadow-glow-dark: 0 0 80px rgba(255,255,255,0.05);
}
```

### Принципы использования

- **Никакого золота, никакого синего пафоса.** Палитра почти монохромная — это и даёт wow через «отсутствие лишнего».
- **Тёмные секции** — только осознанно (hero, ачивки, transitions). 90% сайта светлое.
- **Цветовые акценты** появляются точечно для статусов (✅ зелёный, ⚠️ жёлтый, ❌ красный) — не для бренда.
- **Контраст текста** ≥7:1 на основном фоне (AAA уровень).

### Тёмная тема (опционально)

Системная dark-mode поддерживается. Применяется ко всему сайту через `data-theme="dark"`. Hero остаётся тёмным в обеих темах, основной контент инвертируется.

---

## 3. Типографика

### Шрифты

**Один шрифт на всё: Geist Sans** (или Inter, технически взаимозаменяемы).

```css
font-family: 'Geist Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
```

Зачем один шрифт — это и есть минимализм. Wow-эффект достигается через **разницу размеров и весов**, не через смешение шрифтов.

Опционально для **display-цифр** в hero (237, 5000, 7000, 7000) — Geist Mono или Inter Display variant. Цифры выглядят выразительнее в моноширинном начертании.

### Шкала размеров

| Уровень | Размер | Вес | Tailwind | Использование |
|---|---|---|---|---|
| **Display XL** | 80-120px | 800 | `text-[120px] font-extrabold tracking-tighter` | Hero «КРЕСТ» |
| **Display L** | 56-72px | 700 | `text-7xl font-bold tracking-tight` | Заголовки секций лендинга |
| **Display M** | 40-48px | 700 | `text-5xl font-bold tracking-tight` | H1 страниц админки |
| **H1** | 28-32px | 700 | `text-3xl font-bold` | Заголовок дашборда, страниц MiniApp |
| **H2** | 22-24px | 600 | `text-2xl font-semibold` | Заголовки блоков, секций |
| **H3** | 17-18px | 600 | `text-lg font-semibold` | Заголовки карточек |
| **Body L** | 16-17px | 400 | `text-base` | Основной текст, описания |
| **Body** | 14-15px | 400 | `text-sm` | Вторичный текст |
| **Caption** | 12-13px | 500 | `text-xs font-medium` | Подписи, статусы, даты |
| **Micro** | 10-11px | 600 | `text-[11px] uppercase tracking-wider font-semibold` | Бейджи, теги |

### Леттеринг (letter-spacing)

- **Display:** `tracking-tighter` (-0.04em) — крупные заголовки выглядят дороже стянутыми
- **H1-H3:** `tracking-tight` (-0.02em)
- **Body:** дефолт (0)
- **Caps/бейджи:** `tracking-wider` (+0.05em)

### Высота строки

- Display: `leading-none` (1.0) или `leading-tight` (1.1)
- Заголовки: `leading-tight` (1.2)
- Body: `leading-relaxed` (1.6) — для читаемости длинных текстов (конспекты, транскрипции)

---

## 4. Лейаут — Лендинг (`/`)

```
┌────────────────────────────────────────────────────────────┐
│  HERO (тёмный, 100vh)                                       │
│                                                             │
│  [фоновое изображение: небо + светящийся крест]              │
│  [cursor glow эффект следует за мышью]                       │
│                                                             │
│                       КРЕСТ (Display XL, white)             │
│                                                             │
│         Великое Поручение Иисуса Христа                     │
│             (Body L, muted-on-dark)                         │
│                                                             │
│         «Матфея 28:18-20 — Итак идите, научите все народы»  │
│                                                             │
│         ─────────────────                                   │
│                                                             │
│         237          5000         7000        7000          │
│         СТРАН    НАРОДНОСТЕЙ    ГОРНИЦ      УЧЕНИКОВ        │
│                                                             │
│         [Войти в КРЕСТ]   [Узнать больше →]                 │
│                                                             │
│                          ↓ scroll                           │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│  СЕКЦИЯ 1: «Что такое КРЕСТ» (светлая)                      │
│                                                             │
│  Display L заголовок                                        │
│  Body L описание в 2-3 предложения                          │
│                                                             │
│  [визуализация: 10 кругов-блоков курса с названиями]         │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│  СЕКЦИЯ 2: «Как это работает» (светлая)                     │
│                                                             │
│  3 карточки: Ученик / Куратор / Курс                        │
│  С иконками Lucide и короткими описаниями                   │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│  СЕКЦИЯ 3: «Видение» (тёмный оазис)                         │
│                                                             │
│  Большой текст про 3 курса (КРЕСТ → 10 писем → 20 писем)    │
│  Cursor glow тоже тут                                       │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│  СЕКЦИЯ 4: «Команда» (светлая)                              │
│                                                             │
│  Фото 4 super-admin (Михаил, Алекс, Эля, Игорь)             │
│  Без названия должностей, просто имена и города             │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│  CTA снизу: «Найти куратора в своём городе» (тёмная)        │
│  Большая кнопка ведёт в /m/onboarding                       │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│  Footer (минимальный)                                       │
│  Контакты, ссылки, год                                      │
└────────────────────────────────────────────────────────────┘
```

### Hero — детали для Midjourney

**Фоновое изображение:**

Промпт:
```
Cinematic ethereal sky, soft volumetric clouds, golden rays of sunlight
breaking through, glowing white cross silhouette at center, peaceful
atmosphere, dark gradient at edges fading to luminous center,
photorealistic, 8K, hyper-detailed, no text, no people, no buildings
--ar 16:9 --v 6 --style raw
```

Вариации (если первый не подойдёт):
- `--style raw → --stylize 750` (более художественный)
- Заменить `golden` на `silver` (если золото читается как церковное)
- Заменить `cross silhouette` на `light pillar with cross-shape` (более абстрактно)

Сгенерить 6-10 вариантов, выбрать тот, где **крест читается, но не доминирует**. Изображение должно работать как фон под текст, не отвлекать.

**Cursor glow реализация:**

```tsx
// components/CursorGlow.tsx
'use client';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useEffect } from 'react';

export function CursorGlow() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 30 });
  const sy = useSpring(y, { stiffness: 200, damping: 30 });

  useEffect(() => {
    const handler = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY); };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [x, y]);

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background: useTransform([sx, sy], ([cx, cy]) =>
          `radial-gradient(600px circle at ${cx}px ${cy}px, rgba(255,255,255,0.06), transparent 40%)`
        ),
      }}
    />
  );
}
```

Применяется только на тёмных секциях. Внутри светлых секций cursor glow не делается (там нет смысла).

---

## 5. Лейаут — MiniApp (`/m/*`)

Mobile-first, ширина viewport (Telegram Mini App автоматически подгоняет). При открытии в браузере на десктопе — центрируется в колонке max-width 480px.

```
┌─────────────────────────────────┐
│ Telegram BackButton (нативный)  │
├─────────────────────────────────┤
│ Header                          │
│   Аватар + имя + город          │
├─────────────────────────────────┤
│ Main (scrollable)               │
│                                 │
│   [контент экрана]              │
│                                 │
├─────────────────────────────────┤
│ Bottom Nav (4 кнопки)           │
│ Дашборд • Тренажёр • Чат • Ещё  │
└─────────────────────────────────┘
```

«Ещё» открывает sheet с: Профиль / Раздел «Важно» (для curator+) / Настройки / Выход.

### Принципы MiniApp

- **Большие тач-таргеты** ≥48px высотой
- **Минимум текста на экране**, информация раскрывается клик-на-клик
- **Telegram themeParams** учитываются (тёмная тема в Telegram → MiniApp адаптируется через CSS-переменные)
- **HapticFeedback** на важных действиях (одобрение, отправка submission, открытие нового блока)

---

## 6. Лейаут — Веб-админка (`/admin/*`)

Desktop-first, адаптивная под планшеты. На мобильном sidebar в drawer.

```
┌──────────────────────────────────────────────────────────────┐
│  КРЕСТ        🔍 Search (⌘K)              👤 Имя куратора     │
├────────────┬─────────────────────────────────────────────────│
│ Sidebar    │ Main Content                                    │
│ 240px      │                                                 │
│            │ Page header (заголовок + действия)               │
│ Дашборд    │                                                 │
│ Группа     │ ┌─── Блок данных ────┐                           │
│ Календарь  │ │ Таблица / карточки │                           │
│ Экзамены   │ └────────────────────┘                           │
│ Чат        │                                                 │
│ Важно      │ ┌─── Доп. секции ────┐                           │
│ ─────────  │ └────────────────────┘                           │
│ (super)    │                                                 │
│ Контент    │                                                 │
│ Города     │                                                 │
│ Роли       │                                                 │
│ Аналитика  │                                                 │
└────────────┴─────────────────────────────────────────────────┘
```

### Mobile-навигация админки

При `< md (768px)`:
- Sidebar скрыт за бургером, открывается как drawer слева
- Поиск ⌘K заменяется на иконку лупы

---

## 7. Список экранов (полный)

### Лендинг

| # | Экран | Путь | Layout |
|---|---|---|---|
| 1 | Главная | `/` | Hero + 5 секций |
| 2 | Войти | `/login` | Centered form |

### MiniApp (для ученика и куратора через Telegram или браузер)

| # | Экран | Путь | Layout |
|---|---|---|---|
| 3 | Онбординг | `/m/onboarding` | Wizard 5 шагов |
| 4 | Дашборд курса | `/m/dashboard` | Список 10 блоков + прогресс |
| 5 | Урок (12 пунктов) | `/m/lesson/[blockId]` | 12 карточек-пунктов |
| 6 | Тренажёр стихов | `/m/trainer` | Card stack |
| 7 | Чат с куратором | `/m/chat` | Threaded messages |
| 8 | Раздел «Важно» (curator+) | `/m/important` | Список ресурсов |
| 9 | Профиль | `/m/profile` | Form |
| 10 | Достижения | `/m/achievements` | Список ачивок |

### Веб-админка (для curator / admin / super_admin)

| # | Экран | Путь | Доступ |
|---|---|---|---|
| 11 | Дашборд куратора | `/admin/dashboard` | curator+ |
| 12 | Моя группа | `/admin/group` | curator+ |
| 13 | Дневной календарь | `/admin/calendar` | curator+ |
| 14 | Карточка ученика | `/admin/student/[id]` | curator+ (свои), admin+ (любые) |
| 15 | Экзамены (pending) | `/admin/exams` | curator+ |
| 16 | Чат | `/admin/chat` | curator+ |
| 17 | Раздел «Важно» | `/admin/important` | curator+ |
| 18 | Управление контентом | `/admin/content` | super_admin |
| 19 | Управление городами | `/admin/cities` | super_admin |
| 20 | Управление ролями | `/admin/roles` | admin+ |
| 21 | Аналитика | `/admin/analytics` | admin+ |

### Состояния каждого экрана

Все экраны должны обрабатывать 4 состояния:
- **Loading** — skeleton или spinner
- **Empty** — иллюстрация + текст + CTA («Нет учеников в группе. Добавь первого»)
- **Error** — toast или полноэкранный error с кнопкой «Обновить»
- **Success** — данные + интеракции

---

## 8. Компоненты

### Базовая библиотека: shadcn/ui

```bash
npx shadcn@latest add button input label card dialog sheet
npx shadcn@latest add dropdown-menu select checkbox switch
npx shadcn@latest add table badge avatar separator
npx shadcn@latest add toast tabs skeleton alert
npx shadcn@latest add command popover calendar
npx shadcn@latest add form textarea progress
npx shadcn@latest add hover-card tooltip accordion
```

Все компоненты живут в `apps/web/src/components/ui/` (генерация через CLI).

### Кастомизация shadcn/ui

Цвета через CSS-переменные из @theme — shadcn/ui автоматически подхватит. Не переопределяем компоненты, только токены.

### Кастомные feature-компоненты (`apps/web/src/components/features/`)

| Компонент | Где используется | Что делает |
|---|---|---|
| `<Hero />` | Лендинг | Full-viewport hero с тёмным фоном, cursor glow, фоновым изображением |
| `<CursorGlow />` | Тёмные секции | Светящаяся точка следящая за курсором |
| `<BlockCard />` | MiniApp дашборд | Карточка одного из 10 блоков с состоянием |
| `<AssignmentCard />` | MiniApp lesson | Карточка одного из 12 пунктов ДЗ |
| `<KinescopePlayer />` | MiniApp lesson | Embed Kinescope + no-skip overlay |
| `<MediaRecorder />` | MiniApp lesson, chat | Запись voice/video-кружка через MediaRecorder |
| `<DailyCalendar />` | Админка `/admin/calendar` | Таблица учеников × дней |
| `<StudentCard />` | Админка `/admin/group` | Карточка одного ученика |
| `<SubmissionReview />` | Админка `/admin/student/[id]` | UI для одобрения/отклонения с комментарием |
| `<ChatThread />` | MiniApp + админка | Threaded messaging с реалтайм |
| `<TrainerExercise />` | MiniApp `/m/trainer` | Один раунд тренажёра (стих + ввод + ИИ-проверка) |
| `<AchievementUnlock />` | MiniApp при passing final exam | Полноэкранная анимация ачивки «Мастер Креста» |

### Кастомные UI-компоненты (`apps/web/src/components/ui/custom/`)

| Компонент | Что делает |
|---|---|
| `<NumberStat />` | Большая цифра + подпись (для hero «237 / 5000 / 7000») |
| `<ScrollIndicator />` | Стрелочка «↓» внизу hero, fade-out при скролле |
| `<StatusBadge />` | Цветной бейдж: pending / approved / rejected с иконкой |

---

## 9. Анимации (Framer Motion)

### Принципы

- **Длительность:** 200-400ms (большая — для wow, маленькая — для отзывчивости)
- **Easing:** `[0.16, 1, 0.3, 1]` (cubic-bezier для премиального ощущения, как у superhuman)
- **Уважать `prefers-reduced-motion`** — если включено, отключаем все нестрогие анимации, оставляем только функциональные (loading)

### Анимационные паттерны

| Где | Что | Параметры |
|---|---|---|
| Hero лендинга | Фоновое изображение fade-in + scale 1.05 → 1.0 | duration: 1.5s |
| Hero текст | Stagger fade-up каждого элемента (заголовок, подзаголовок, цифры, CTA) | delay 0.2s между, duration 0.6s |
| Cursor glow | Spring follow за мышью | stiffness: 200, damping: 30 |
| Scroll reveal | Появление секций при попадании в viewport (Intersection Observer + opacity/translate) | once: true, margin: -100px |
| Card hover | Подъём карточки на 4px + усиление тени | duration 200ms |
| Page transitions | Fade + tiny translate-y | 250ms |
| Achievement unlock | Confetti + scale 0→1.1→1.0 + glow pulse | duration 1.2s, blocking 2s |
| Modal open | Backdrop fade + dialog scale 0.95→1.0 | 200ms |
| Toast | Slide-in from top + fade | 300ms |
| Submission approval ✅ | Чекмарк рисуется path-by-path | 500ms |

### Cursor glow — финальный код

См. секцию 4 (Hero лендинга). Применяется как `<CursorGlow />` на любой странице где нужно — но обычно только на лендинге и на странице ачивки.

---

## 10. Иконки

### Lucide React (везде)

Один набор иконок на весь проект — **Lucide React**. Подключение:

```tsx
import { Check, X, Lock, Unlock, Clock, Users, BookOpen, Settings,
         MessageCircle, Calendar, GraduationCap, Trophy,
         FileText, Video, Mic, Camera, Cross, Heart } from 'lucide-react';
```

### Эмодзи в UI

**Минимально.** Используем для функциональных бейджей и пуш-сообщений, не для декорации.

| Контекст | Эмодзи | Где |
|---|---|---|
| Одобрено | ✅ | Status badge |
| Отклонено | ❌ | Status badge |
| Ожидает | ⏳ | Status badge |
| Заблокировано | 🔒 | Карточка блока |
| Алерт куратору | ⚠️ | Push notification |
| Тревога куратору | 🚨 | Push notification |
| Ачивка | 🏆 | Page «Достижения» + push |

Никаких 🙏, ✝️, 🤍, ⛪ — это и есть «церковный стиль».

### Иконка платформы (логотип КРЕСТ)

Простой sans-serif wordmark «КРЕСТ» крупными буквами с `tracking-tighter`. Возможно один маленький символ — крест-точка между К и Р или знак ✕ как абстрактный знак вместо «крест-силуэт».

Подбор финального логотипа — через Midjourney + ручная итерация. Промпт:
```
minimalist wordmark logo "КРЕСТ" Cyrillic, modern sans-serif typography,
black on white, single accent dot or geometric mark, no religious imagery,
no decorative elements, premium tech aesthetic --v 6
```

---

## 11. Иллюстрации

### Стратегия

- **Лендинг:** одна большая фотореалистичная иллюстрация в hero (Midjourney)
- **Внутренние страницы:** иллюстраций нет, только UI и текст. Воздух — это и есть «иллюстрация».
- **Empty states:** простые SVG-иллюстрации (минимум деталей) или одна большая иконка Lucide
- **Ачивки:** анимированные графические композиции через Framer Motion (не статичные картинки)

### Midjourney промпты для платформы

#### Hero лендинга
```
Cinematic ethereal sky, soft volumetric clouds, golden rays of sunlight
breaking through, glowing white cross silhouette at center, peaceful
atmosphere, dark gradient edges, photorealistic, 8K, hyper-detailed,
no text, no people, no buildings --ar 16:9 --v 6 --style raw
```

#### Открытка для ачивки «Мастер Креста»
```
Abstract minimalist composition, soft gradient from deep blue to warm light,
subtle cross-shaped light beam, no figurative elements, peaceful, premium,
design-forward, --ar 4:5 --v 6
```

#### Empty state иллюстрация
```
Single line illustration, minimalist, abstract figure walking towards
horizon, very simple, monochromatic, lots of negative space
--ar 1:1 --v 6 --style raw
```

### Где НЕ нужны иллюстрации

- В админке (только данные и UI, иллюстрации отвлекают)
- Внутри MiniApp на дашборде и lesson-страницах (информационные)

---

## 12. Адаптивные брейкпоинты

Tailwind v4 default + один кастомный для мобильных Telegram-устройств.

| Brakpoint | Ширина | Контекст |
|---|---|---|
| `< sm` (320-639) | моб портрет | Telegram MiniApp в основном; mobile веб |
| `sm` (640-767) | моб ландшафт | Telegram MiniApp в landscape |
| `md` (768-1023) | планшет | Веб-админка с компактным sidebar |
| `lg` (1024-1279) | ноутбук | Веб-админка с полным sidebar |
| `xl` (1280-1535) | десктоп | Веб-админка просторно |
| `2xl` (1536+) | большой десктоп | Лендинг, опционально |

### Поведение

- **< md (768px):** sidebar админки в drawer, single column main content, mobile-first
- **md-lg:** sidebar collapsed (icons only) или полный + 2-column main
- **> lg:** full sidebar + multi-column main

Лендинг адаптируется отдельно:
- < md: hero на 100vh, цифры в столбец
- ≥ md: hero на 100vh, цифры в строку

---

## 13. Доступность (a11y)

- **Семантический HTML** — `<button>`, `<nav>`, `<main>`, `<article>`, `<section>` где они уместны
- **`aria-label`** на всех иконках-кнопках без видимого текста
- **Контраст текста** ≥7:1 (AAA) на основных фонах. Для второстепенного текста ≥4.5:1
- **Focus-trap** в модалках и drawer'ах
- **Keyboard navigation** — Tab/Shift+Tab/Enter/Escape работают везде в админке. В MiniApp keyboard не критичен (пользователи на телефоне)
- **Размер touch-target** ≥44×44px (Apple HIG) на мобильных
- **`prefers-reduced-motion`** — отключаем анимации Framer Motion при включённом флаге
- **Screen reader friendly** — каждая страница имеет один `<h1>`, заголовки иерархичны, картинки имеют `alt`

---

## 14. Дизайн-токены — экспорт

Для использования в коде:

```ts
// apps/web/src/lib/design-tokens.ts
export const tokens = {
  colors: {
    bg: 'var(--color-bg)',
    bgSubtle: 'var(--color-bg-subtle)',
    bgDark: 'var(--color-bg-dark)',
    text: 'var(--color-text)',
    textMuted: 'var(--color-text-muted)',
    accent: 'var(--color-accent)',
    border: 'var(--color-border)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
  },
  shadows: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
    glowDark: 'var(--shadow-glow-dark)',
  },
  spacing: { /* Tailwind default используется */ },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
  },
} as const;
```

---

## 15. Нотация для дизайна экранов

При обсуждении конкретных экранов используем единую нотацию:

```
Экран: /m/lesson/[blockId]
Layout: stack column, padding 16px
─────────────────────────────────────
[Header]
  ← BackButton (нативный Telegram)
  H1: «Блок 1: Малый Крест»
  Caption: «Пройдено 5 из 10 пунктов»

[12 карточек ДЗ — vertical stack]
  Card #1: Подготовка
    Status: ✅ done (auto)
  Card #2: Основное видео
    Status: ✅ approved
  Card #3: Дополнительное видео
    Status: ⏳ pending → клик открывает плеер
  ...

[Bottom CTA — sticky если все ✅]
  Кнопка «Готов сдавать куратору» (full-width, bg-accent)
```

Эта нотация — для разработчика, не для пользователя. На её основе верстается компонент.

---

## 16. Что НЕ входит в этот документ

- Точная вёрстка каждого экрана (это делается на этапе реализации, по нотации)
- Детальные спецификации компонентов (всё через shadcn/ui — там есть документация)
- Pixel-perfect маппинг с Figma (Figma не используем, дизайн-первый = код-первый)

---

## 17. Связанные документы

- `SPEC.md` v3.0 — техническая спецификация (что делаем)
- `memory/project_design_direction.md` — высокоуровневое решение по стилю
- `memory/project_lesson_model_v2.md` — 12-пунктовая модель урока (для UI lesson-экрана)
- `memory/project_completion_achievements.md` — тексты ачивок (для UI achievement-экранов)

---

*Версия 3.0 | Дата: 2026-05-01 | Spec-First Pipeline шаг 5/9 | Замещает v1.0 полностью*
