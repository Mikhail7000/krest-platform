# КРЕСТ — UI/UX Brief

> Версия: 1.0 | Дата: 2026-04-26
> Дизайн-система для всех экранов: Telegram Mini App + Next.js веб-админка.

---

## 1. Общее описание интерфейса

### Концепция
**"Тёплый минимализм с золотым акцентом"** — иконы как духовный визуальный код, navy-фон как небо/глубина, золото как свет/благодать. Не агрессивный современный, не древний православный стиль. Дружественный, спокойный, ведущий.

### Целевая аудитория
- **Технический уровень:** новичок (студенты-ищущие 18-45) и опытный (пасторы 30+)
- **Устройства:** **mobile-first** (студенты в Telegram), **desktop-friendly** (пасторы за компом)
- **Контекст использования:** в дороге (студент, 5-15 мин), за рабочим столом (пастор, 30-60 мин)

### Ключевые референсы

1. **Telegram Wallet** — как Mini App выглядит изнутри, плавность анимаций, привычка пользователя
2. **Linear** — для веб-админки: чистая навигация, плотность информации без перегруза
3. **YouVersion (Bible.com)** — типографика для длинных текстов (конспекты), читабельность
4. **Notion mobile** — карточки, состояния, мягкие тени

---

## 2. Цветовая схема

### Режим: dark-first (соответствует Telegram theme), с поддержкой light для веб-админки

### Основные цвета (Tailwind v4 @theme)

```css
@theme {
  /* Бренд-акцент: золото = благодать, свет, ценность */
  --color-primary: #C9A961;            /* Gold 500 */
  --color-primary-hover: #B89548;      /* Gold 600 */
  --color-primary-muted: #C9A96126;    /* Gold с alpha 15% */

  /* Вторичный: indigo = небо, глубина, духовное */
  --color-secondary: #4F46E5;          /* Indigo 600 */

  /* Фоны */
  --color-bg: #0A0E1A;                 /* Navy near-black */
  --color-bg-card: #141828;            /* Карточки на чуть светлее */
  --color-bg-sidebar: #0F1320;
  --color-bg-overlay: rgba(10,14,26,0.85); /* для модалок */

  /* Текст */
  --color-text: #F5F5F7;               /* Off-white, не чистый */
  --color-text-muted: #8E8E93;         /* iOS-style hint */
  --color-text-inverse: #0A0E1A;       /* для золотых кнопок */

  /* Статусы */
  --color-success: #34C759;            /* iOS Green */
  --color-warning: #FF9F0A;            /* Amber */
  --color-error: #FF3B30;              /* iOS Red */
  --color-info: #0A84FF;               /* iOS Blue */

  /* Границы */
  --color-border: rgba(255,255,255,0.08);
  --color-border-hover: rgba(201,169,97,0.3); /* gold tint */

  /* Tailwind v4 синтаксис */
  --shadow-card: 0 4px 20px rgba(0,0,0,0.3);
  --shadow-elevated: 0 8px 32px rgba(201,169,97,0.15);
}
```

### Light theme для веб-админки (override)

```css
[data-theme="light"] {
  --color-bg: #FFFFFF;
  --color-bg-card: #F9FAFB;
  --color-bg-sidebar: #F3F4F6;
  --color-text: #1F2937;
  --color-text-muted: #6B7280;
  --color-border: #E5E7EB;
}
```

### Скругления (Tailwind classes)

| Элемент | Значение | Класс |
|---------|----------|-------|
| Кнопки | 10-12px | `rounded-xl` |
| Карточки | 14-16px | `rounded-2xl` |
| Инпуты | 10px | `rounded-xl` |
| Аватарки | 9999px | `rounded-full` |
| Модалки | 16-20px | `rounded-3xl` |
| Toast | 10px | `rounded-xl` |

### Glassmorphism (для карточек на дашборде)

```css
background: rgba(255,255,255,0.06);
backdrop-filter: blur(10px);
border: 1px solid rgba(201,169,97,0.15);
```

---

## 3. Типографика

### Шрифты

- **Основной:** Inter (sans-serif, 400/500/600/700/800) — для всего UI
- **Моноширинный:** Geist Mono — для кода, ID, технических полей

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
```

### Размеры (mobile-first)

| Уровень | Размер | Tailwind | Использование |
|---------|--------|----------|---------------|
| H1 страницы | 24-28px / 700 | `text-2xl font-bold` | Заголовок дашборда, лендинга |
| H2 секции | 18-20px / 700 | `text-lg font-bold` | Заголовок блока, секции |
| H3 карточки | 15-16px / 600 | `text-base font-semibold` | Название блока в списке |
| Body | 14-15px / 400 | `text-sm` | Основной текст |
| Caption | 12-13px / 500 | `text-xs font-medium` | Подписи, даты, статусы |
| Micro | 10-11px / 700 letterSpacing 0.5 | `text-[11px] tracking-wider uppercase` | Бейджи, теги |

### Леттеринг

- **Заголовки:** `letter-spacing: -0.02em` (стянутые)
- **Caps/бейджи:** `letter-spacing: 0.05em` (расширенные)

---

## 4. Лейаут и навигация

### Mini App (mobile-only, ширина устройства)

```
┌─────────────────────────────┐
│ ← (BackButton от Telegram)  │
├─────────────────────────────┤
│ Header                      │
│ ─ Avatar + Name             │
│ ─ Streak (🔥 5)             │
├─────────────────────────────┤
│ Main Content                │
│ ─ Прокручиваемая область    │
│ ─ Карточки блоков           │
│ ─ Action buttons            │
├─────────────────────────────┤
│ Bottom Nav (3 кнопки)       │
│ Дашборд / Тренажёр / Профиль│
└─────────────────────────────┘
```

**Ширина:** 100% viewport (Telegram Mini App автоматически адаптирует).

### Веб-админка (desktop-first, адаптивная)

```
┌──────────────────────────────────────────────────────┐
│  Logo КРЕСТ      🔍 Search (⌘K)         👤 Pastor   │
├──────────┬───────────────────────────────────────────│
│          │                                          │
│ Sidebar  │  Main Content                            │
│ 240px    │                                          │
│          │  ┌─── Stats (4 карточки) ───┐            │
│ ─ Дашб.  │  │ Total / Active / ... │  │            │
│ ─ Студ.  │  └────────────────────────┘            │
│ ─ Когорт │                                          │
│ ─ Контнт │  ┌─── Pending Approvals ───┐             │
│ ─ Профил │  │  Card / Card / Card     │             │
│          │  └─────────────────────────┘             │
│          │                                          │
│ ⚙ Конф.  │                                          │
└──────────┴──────────────────────────────────────────┘
```

### Mobile-навигация (веб-админка)

- Sidebar **скрыт за бургером** при `< md (768px)`
- Drawer открывается слева, перекрывает контент

---

## 5. Список экранов

### Telegram Mini App

| # | Экран | Путь | Layout | Состояния |
|---|-------|------|--------|-----------|
| 1 | Регистрация / лендинг бота | `/miniapp/index.html` (если не залогинен) | Single column | default, loading, error |
| 2 | Онбординг | `/miniapp/setup.html` | 3 шага slide | step 1/2/3, loading |
| 3 | Дашборд студента | `/miniapp/index.html` (если залогинен) | List with cards | loading, data, empty |
| 4 | Урок | `/miniapp/lesson.html?blockId=N` | Full-width video + form | loading, video, forum, konspekt, approval |
| 5 | Тренажёр стихов | `/miniapp/trainer.html` | Card stack | loading, exercise, complete |
| 6 | Профиль | `/miniapp/profile.html` | Form | view, edit, saving |
| 7 | Админ-панель в Telegram | `/miniapp/admin.html` | Tabs | loading, pending, all, cohorts |

### Next.js веб-админка

| # | Экран | Путь | Layout | Состояния |
|---|-------|------|--------|-----------|
| 8 | Лендинг для пасторов | `/` | Marketing pages | static |
| 9 | Регистрация церкви | `/register-church` | Form | default, validating, success |
| 10 | Вход | `/login` | Centered form | default, loading, error |
| 11 | Дашборд лидера | `/admin` | Sidebar + Stats | loading, data |
| 12 | Список студентов | `/admin/students` | Sidebar + Table | loading, data, filtered, empty |
| 13 | Малые группы | `/admin/cohorts` | Sidebar + Cards | loading, data, empty |
| 14 | Редактор контента | `/admin/editor` | Sidebar + Editor | loading, editing, saving |
| 15 | Профиль | `/admin/profile` | Sidebar + Form | view, edit |

---

## 6. Библиотека компонентов

### shadcn/ui (для Next.js веб-админки)

```bash
npx shadcn@latest add button input label card dialog sheet
npx shadcn@latest add dropdown-menu select checkbox switch
npx shadcn@latest add table badge avatar separator
npx shadcn@latest add toast tabs skeleton alert
npx shadcn@latest add command popover calendar
npx shadcn@latest add form textarea progress
```

### Telegram Mini App — кастомные компоненты (Vanilla)

| Компонент | Файл | Что делает |
|-----------|------|-----------|
| `renderNav(profile, isAdmin)` | `js/auth.js` | Топ-навигация в `#topnav` |
| `toast(msg, type)` | `js/auth.js` | Уведомления success/error/info |
| `requireAuth()` / `requireAdmin()` | `js/auth.js` | Guard страницы, возвращает {user, profile} |
| `BlockCard(block, status)` | `js/components.js` 🆕 | Карточка блока на дашборде |
| `StreakBadge(count, status)` | `js/components.js` 🆕 | Иконка серии (🔥) |
| `CohortInvite(cohort)` 🆕 | `js/components.js` | Карточка приглашения в Telegram-группу |

### Next.js features-компоненты (`apps/web/src/components/features/`)

| Компонент | Что делает |
|-----------|-----------|
| `StatsCards` | 4 карточки KPI на дашборде |
| `PendingApprovalCard` | Карточка ожидающего одобрения |
| `StudentTable` | Таблица всех студентов с фильтрами |
| `CohortGrid` | Сетка малых групп |
| `ContentEditor` | Редактор для блоков/уроков (Tiptap или textarea) |
| `ChurchOnboarding` | Wizard регистрации церкви |

---

## 7. Адаптивные точки

Tailwind v4 default breakpoints:

| Breakpoint | Ширина | Кто пользуется |
|-----------|--------|----------------|
| `< sm` (320-639) | моб портрет | Telegram Mini App в основном |
| `sm` (640-767) | моб ландшафт | Telegram Mini App в landscape |
| `md` (768-1023) | планшет | Веб-админка с компактным sidebar |
| `lg` (1024-1279) | ноутбук | Веб-админка с полным sidebar |
| `xl` (1280-1535) | десктоп | Веб-админка просторно |
| `2xl` (1536+) | большой десктоп | Веб-админка с widescreen layout |

### Поведение

- **< md (768px):** sidebar в drawer, single column main, mobile-first
- **md-lg:** sidebar collapsed (icons only), 2-3 column main
- **> lg:** full sidebar, multi-column

---

## 8. Анимации и переходы

### Общие принципы

- **Длительность:** 150-300ms (не замедляют работу)
- **Easing:** `ease-out` для появления, `ease-in` для исчезновения
- Уважать `prefers-reduced-motion` — отключать анимации полностью

### Конкретные анимации

| Элемент | Анимация | Tailwind / CSS |
|---------|----------|---------------|
| Модалки | Fade in + scale 95→100% | `transition-all duration-200` |
| Telegram Sheet | Slide from bottom | Native Telegram API |
| Sidebar mobile drawer | Slide from left | `transition-transform duration-300` |
| Skeleton loading | Pulse | `animate-pulse` |
| Toast | Slide from right | `animate-in slide-in-from-right` |
| Block card hover | Background + tiny scale | `hover:bg-card-hover hover:scale-[1.02] transition-all` |
| Streak counter "+1" | Bounce + fade | Кастомная keyframe |
| Approval ✅ появление | Scale 0→100% + ротация | `animate-in zoom-in-50 spin-in-180` |
| Approval ❌ → форум | Slide-out + slide-in новой формы | Sequential transition |
| Cohort invite | Confetti burst (один раз) | canvas-confetti library |

### Микро-интеракции

- Кнопка нажата → `scale(0.96) opacity-0.9` (`active:scale-95`)
- Hover на интерактивный элемент → cursor pointer + background change 200ms
- Focus на input → border golden + subtle glow 200ms

---

## 9. Состояния UI (обязательные для каждого экрана)

### 1. Loading
- **Skeleton** для известного layout (карточки блоков, список студентов)
- **Spinner** для unknown layout (загрузка данных)
- НЕ оставлять пустой экран

### 2. Empty
- **Иллюстрация** (SVG) или эмодзи (🎉, 👥, 📚)
- **Текст** объясняющий состояние ("Нет ожидающих одобрения")
- **CTA-кнопка** ("Создайте первый блок")

### 3. Error
- **Toast** для временных ошибок (сеть, валидация)
- **Inline error** под полем формы
- **Полноэкранный error** с кнопкой "Обновить" для критичных ошибок

### 4. Success
- **Toast** "Сохранено!" + auto-dismiss через 3 сек
- **Haptic feedback** в Telegram Mini App
- **Confetti** для значимых событий (одобрение блока, завершение курса)

### Формы

- Валидация **inline** под каждым полем
- Кнопка **disabled + spinner** при loading
- Успех → **toast + редирект** (или закрытие модалки)
- Ошибка → **toast + подсветка** проблемного поля

---

## 10. Иконки

### Lucide React (для Next.js)

```tsx
import { Check, X, Lock, Unlock, Clock, Flame, Users, BookOpen, Settings } from 'lucide-react';
```

### Эмодзи (для Telegram Mini App)

| Контекст | Эмодзи |
|----------|--------|
| Streak | 🔥 |
| Одобрено | ✅ |
| Ожидает | ⏳ |
| Заблокировано | 🔒 |
| Доработка | 🔄 |
| Малая группа | 👥 |
| Книга/Библия | 📖 |
| Тренажёр | 🎯 |
| Уведомление | 🔔 |
| Лидер | 👨‍🏫 |

---

## 11. Доступность (a11y)

- Семантический HTML (`<button>`, `<nav>`, `<main>`, `<article>`)
- `aria-label` на иконках-кнопках без текста
- Контраст текста ≥4.5:1 (проверено для navy bg + off-white text)
- Focus-trap в модалках
- Keyboard navigation (Tab/Enter/Escape) — обязательно для веб
- Размер touch-target ≥44×44px (Telegram Mini App)

---

## 12. Скриншоты-референсы (готовые экраны)

### Главный экран Mini App
- Тёмный фон navy
- Сверху: glassy header с аватаром + streak (🔥 5)
- Список 6 карточек блоков:
  - Активный: золотая граница, прогресс-бар
  - Завершённый: ✅ + полупрозрачный
  - Заблокированный: 🔒 + серый
- Bottom nav: Дашборд / Тренажёр / Профиль

### Урок (Mini App)
- Видео занимает весь viewport сверху (`paddingTop: 56.25%`)
- Под видео: блок-бейдж "Блок 1" (золотой) + заголовок
- Форум: 3 textarea с counters "0 / 100"
- Кнопка "Отправить ответы" (золотая, full-width)
- После отправки: конспект (rich text с golden подчёркиваниями) + статус-карточка

### Дашборд лидера (веб-админка)
- 4 stats-карточки: Total / Active / Pending / Completed
- Tabs: "Ожидают (3)" / "Все" / "Малые группы"
- Pending: карточки с аватаром студента, блок, кнопки Approve/Reject
- Last activities: лента действий

### Лендинг для пасторов
- Hero: "Узнай христианство за 6 недель" + CTA "Стать партнёром"
- Section "Проблема": 90% бросают
- Section "Решение": 5 функций с иконками
- Section "Pricing": 4 тарифа с подсветкой "Церковь"
- Footer: контакты, документы

---

*Версия 1.0 | Дата: 2026-04-26 | Spec-First Pipeline шаг 5/9*
