# MCP Setup — Команды подключения серверов

> Выполни эти команды в терминале ПЕРЕД запуском автономной сборки.
> После подключения — перезапустить Claude Code.

---

## 1. Context7 — актуальная документация библиотек (ОБЯЗАТЕЛЬНО)

```bash
# Вариант 1: Удалённый сервер (рекомендуется, не нужен Node.js)
claude mcp add --scope user --transport http context7 https://mcp.context7.com/mcp

# Вариант 2: С API-ключом (бесплатный на context7.com/dashboard)
claude mcp add --scope user --transport http --header "CONTEXT7_API_KEY: ВАШ_КЛЮЧ" context7 https://mcp.context7.com/mcp
```

**Как использовать в промтах:**
```
Настрой Supabase Auth для email/password. use context7
Как работает YouTube IFrame API onStateChange? use context7
```

---

## 2. Supabase MCP — прямой доступ к базе данных (ОБЯЗАТЕЛЬНО)

```bash
# Заменить PROJECT_REF на ID вашего Supabase проекта
# Найти: Supabase Dashboard → Settings → General → Reference ID
claude mcp add supabase --transport http "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF"
```

**PROJECT_REF для КРЕСТ:** `aejhlmoydnhgedgfndql` (из config.js)

```bash
claude mcp add supabase --transport http "https://mcp.supabase.com/mcp?project_ref=aejhlmoydnhgedgfndql"
```

---

## 3. Проверка подключения

```bash
# Список подключённых MCP-серверов
claude mcp list

# Ожидаемый результат:
# context7: https://mcp.context7.com/mcp (http)
# supabase: https://mcp.supabase.com/mcp?project_ref=aejhlmoydnhgedgfndql (http)
```

---

## 4. После подключения

1. Перезапустить Claude Code (закрыть и открыть снова)
2. Проверить что MCP работает: написать в чате `use context7` с любым вопросом
3. Запустить финальный промпт из `AUTONOMOUS_BUILD_PROMPT.md`

---

## Troubleshooting

**MCP не подключается:**
```bash
# Удалить и добавить снова
claude mcp remove context7
claude mcp add --scope user --transport http context7 https://mcp.context7.com/mcp
```

**Supabase MCP требует авторизацию:**
```bash
# Добавить с Personal Access Token (Supabase Dashboard → Account → Access Tokens)
claude mcp add supabase --transport http \
  --header "Authorization: Bearer YOUR_SUPABASE_PAT" \
  "https://mcp.supabase.com/mcp?project_ref=aejhlmoydnhgedgfndql"
```
