---
name: run-qa-review
description: Run QA review on changed files — delegates to qa-reviewer agent, returns structured report
---

# Скилл: Запустить QA Review

## Когда использовать

После любых изменений в:
- `student/lesson.html` — lesson flow, форум, видео
- `admin/students.html` — одобрение лидером
- `js/auth.js` — переиспользуемые компоненты
- `supabase/schema.sql` — RLS политики
- `css/styles.css` — если затрагивает видимость элементов (display)

## Что передать QA Reviewer

1. Список изменённых файлов
2. Суть изменений (что добавили/исправили)
3. Какой шаг из flow урока затронут (1–7)

## Чек-лист (минимальный)

```
☐ requireAuth()/requireAdmin() на каждой странице
☐ Конспект скрыт (display:none) до отправки форума
☐ Кнопка "Следующий" заблокирована до admin_approved = true
☐ YouTube no-skip: polling 500мс + seekTo
☐ Форум: минимум 20 символов
☐ Ввод студента через textContent
☐ Нет alert()/confirm()/prompt()
☐ Все строки через T[LANG].key
```

## Формат результата

```
QA REVIEW — [дата] — [файлы]

✅ ПРОШЛО:
- ...

❌ ПРОБЛЕМЫ:
1. [файл:строка] — описание проблемы

ВЕРДИКТ: Готово к деплою | Требует исправлений
```

## Правило

Если QA Reviewer нашёл проблемы — исправляет нужный субагент (Frontend Developer), затем QA Review запускается снова. Деплой только после зелёного вердикта.
