# CREST Platform — Инструкция по запуску

## 1. Подключи Supabase

Открой файл `js/config.js` и замени:

```js
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_KEY';
```

Твои данные — в Supabase → Settings → API:
- **Project URL** → вставь в `SUPABASE_URL`
- **anon public** key → вставь в `SUPABASE_ANON`

---

## 2. Запусти схему базы данных

Открой Supabase → SQL Editor → New Query.
Вставь содержимое файла `supabase/schema.sql` и нажми Run.

---

## 3. Создай первого администратора

1. Зайди в Supabase → Authentication → Users
2. Нажми **Invite User** — введи email лидера
3. После регистрации зайди в Table Editor → profiles
4. Найди строку лидера, измени поле `role` с `student` на `admin`

Теперь лидер может логиниться и давать права другим через страницу Students.

---

## 4. Настрой Storage для фото

Supabase → Storage → New Bucket:
- Name: `uploads`
- Public: ✅ (включи)

Добавь политику доступа:
- Authenticated users can insert/select

---

## 5. Запусти локально

Нужен любой локальный сервер (файлы не работают через file://).

Вариант 1 — VS Code расширение Live Server (рекомендую):
- Установи расширение **Live Server**
- Правый клик на `index.html` → Open with Live Server

Вариант 2 — Python:
```bash
python3 -m http.server 8000
```
Открой http://localhost:8000

---

## Структура проекта

```
/
├── index.html          ← Лендинг (выбор языка, вход)
├── login.html          ← Страница входа
├── course-legacy.html  ← Оригинальный сайт (бэкап)
├── css/
│   └── styles.css      ← Все стили
├── js/
│   ├── config.js       ← Supabase + переводы
│   └── auth.js         ← Авторизация, хелперы
├── admin/
│   ├── index.html      ← Дашборд лидера
│   ├── students.html   ← Студенты + карта
│   └── editor.html     ← Редактор блоков и уроков
├── student/
│   ├── index.html      ← Дашборд студента
│   └── lesson.html     ← Просмотр урока
└── supabase/
    └── schema.sql      ← Схема базы данных
```

---

## Что умеет платформа

### Лидер (admin)
- Видит всех студентов на карте и в таблице
- Следит за прогрессом каждого студента
- Читает дневниковые записи студентов
- Отправляет обратную связь на записи
- Редактирует блоки: добавляет YouTube-видео, текст (RU/EN)
- Выдаёт/забирает права лидера у студентов
- Видит статистику: активные за неделю, ожидают проверки

### Студент
- Проходит 6 блоков курса CREST
- Смотрит YouTube-видео в каждом уроке
- Ведёт дневник (сохраняет черновик / отправляет лидеру)
- Добавляет библейские стихи и отмечает выученные
- Загружает фото рукописных заметок
- Видит обратную связь лидера
- В пятницу отправляет итоговый отчёт
- Указывает своё местоположение (ручное или авто-GPS)
- Переключает язык: RU / EN
