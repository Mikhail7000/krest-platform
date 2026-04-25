---
description: Mandatory Context7 usage before working with any external library or API
globs: ["**/*.html", "**/*.js", "**/*.css", "supabase/**/*.sql"]
---

# Context7 — Обязательное правило

При работе с любой внешней библиотекой или API — запроси актуальную документацию через Context7 MCP **перед написанием кода**.

## Ключевые библиотеки проекта КРЕСТ

- **Supabase JS SDK** (`@supabase/supabase-js`) — auth, database queries, RLS
- **YouTube IFrame API** — player, events, no-skip polling
- **jsPDF** — если добавляем генерацию PDF сертификатов

## Почему это важно

Claude обучен на данных до определённой даты. API Supabase и YouTube постоянно меняются. Без Context7 есть риск написать код по устаревшей документации, который не работает с текущей версией SDK.

## Как использовать

```
use context7 to find current docs for supabase-js select query with RLS
use context7 to find youtube iframe api onStateChange event
```
