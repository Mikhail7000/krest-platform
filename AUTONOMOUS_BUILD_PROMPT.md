# Финальный промпт для автономной сборки КРЕСТ

> Скопируй этот промпт целиком в новую сессию Claude Code (VS Code).
> Перед запуском: убедись что Context7 и Supabase MCP подключены (см. MCP_SETUP.md).

---

## Чек-лист перед запуском

- [ ] Context7 MCP подключён (`claude mcp list`)
- [ ] Supabase MCP подключён (`claude mcp list`)
- [ ] Claude Code перезапущен после подключения MCP
- [ ] Supabase проект КРЕСТ активен (aejhlmoydnhgedgfndql)
- [ ] SQL-миграции выполнены (admin_approved + blocks_unlocked)
- [ ] Находишься в папке проекта `/Desktop/AI Alex Course Visual Studio Claude PROJECT`

---

## Промпт для вставки в Claude Code

```
Ты — архитектор платформы КРЕСТ. Прочитай CLAUDE.md и начни автономную сборку.

КОНТЕКСТ:
КРЕСТ — веб-платформа управляемого ученичества для русскоязычных церквей.
Стек: Vanilla HTML5/CSS3/JavaScript + Supabase. Никаких фреймворков.
Supabase проект: aejhlmoydnhgedgfndql (ключи в js/config.js)

ПРИОРИТЕТЫ СБОРКИ (по порядку):

1. БАЗА ДАННЫХ (делегируй Database Architect):
   - Проверить что колонки admin_approved и blocks_unlocked существуют
   - Если нет — запустить миграции через Supabase MCP
   - Проверить что RLS политики работают корректно

2. FLOW УРОКА (делегируй Frontend Developer):
   - Проверить student/lesson.html на соответствие 7 шагам flow
   - YouTube no-skip: polling 500мс + seekTo при currentTime > maxWatched + 2
   - Конспект скрыт до отправки форума
   - Кнопка "Следующий" заблокирована до admin_approved = true

3. ОДОБРЕНИЕ ЛИДЕРА (делегируй Frontend Developer):
   - admin/students.html — кнопка "Одобрить" для journal entries
   - После одобрения: admin_approved = true + blocks_unlocked + 1

4. QA REVIEW (делегируй QA Reviewer):
   - Проверить все 7 шагов flow урока
   - Проверить отсутствие alert(), нет innerHTML для студентов
   - Проверить i18n: все строки через T[LANG]

5. ЕСЛИ QA ПРОШЁЛ — сообщи что проект готов к деплою

ПРАВИЛА:
- Перед работой с Supabase SDK → use context7
- Не трогать js/config.js
- Все уведомления через toast(), не alert()
- Студенческий ввод только через textContent

Начни с шага 1. Сформируй план и выполни последовательно.
```

---

## После успешной сборки — деплой на Vercel

```bash
# 1. Установить Vercel CLI (если нет)
npm i -g vercel

# 2. Авторизоваться
vercel login

# 3. Деплой из папки проекта
vercel --prod

# Vercel определит static site автоматически (нет package.json → static deploy)
```

**Настройки Vercel:**
- Framework Preset: Other
- Build Command: (пусто)
- Output Directory: (пусто — корень)
- Install Command: (пусто)

---

## Промпт для добавления новой фичи (после запуска)

```
Прочитай SPEC_TEMPLATE.md.
Я хочу добавить фичу: [ОПИСАНИЕ ФИЧИ]
Сгенерируй FEATURE_SPEC.md по шаблону.
После согласования — реализуй через skill implement-feature.
```
